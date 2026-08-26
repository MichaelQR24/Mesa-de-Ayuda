import { API_CONFIG } from '../config/api';
import { authService } from './auth-service';

export type ApiErrorSource =
  | 'frontend'
  | 'validation'
  | 'auth'
  | 'backend'
  | 'database'
  | 'groq'
  | 'rate-limit'
  | 'network'
  | 'unknown';

export interface StructuredApiError {
  code: string;
  message: string;
  source: ApiErrorSource;
  requestId?: string;
  status?: number;
  endpoint?: string;
  details?: Array<{ field: string; message: string }>;
}

export interface AiProcessRequestParams {
  text: string;
  action: 'correct' | 'paraphrase' | 'professionalize' | 'summarize' | 'reply';
  tone?: string;
  paraphraseLevel?: 'soft' | 'medium' | 'complete';
  preserveInfinitives?: boolean;
  redactSensitiveData?: boolean;
}

export interface AiApiResponse {
  success: boolean;
  data?: {
    result: string;
    model: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
  error?: StructuredApiError;
}

async function safeParseResponse<T>(
  response: Response,
  endpoint: string
): Promise<{ ok: boolean; data?: T; error?: StructuredApiError }> {
  const status = response.status;
  const requestId = response.headers.get('x-request-id') || undefined;

  let bodyText = '';
  try {
    bodyText = await response.text();
    const json = JSON.parse(bodyText);

    if (json && typeof json === 'object') {
      if (json.success === false && json.error) {
        return {
          ok: false,
          error: {
            code: json.error.code || 'SERVER_ERROR',
            message: json.error.message || `Error del servidor (HTTP ${status}).`,
            source: json.error.source || (status === 401 || status === 403 ? 'auth' : status === 400 ? 'validation' : status === 502 || status === 504 ? 'groq' : 'backend'),
            requestId: json.error.requestId || requestId,
            status,
            endpoint,
            details: json.error.details,
          },
        };
      }
      return { ok: response.ok, data: json as T };
    }
  } catch {}

  // Fallback para respuestas no JSON (ej. HTML 404/502 de proxies/Render)
  let source: ApiErrorSource = 'backend';
  let code = 'HTTP_ERROR';
  let message = `Error del servidor HTTP ${status}`;

  if (status === 404) {
    source = 'backend';
    code = 'NOT_FOUND';
    message = `No se encontró el servicio en ${API_CONFIG.BASE_URL} (HTTP 404). Verifica que la URL del backend sea correcta.`;
  } else if (status === 502 || status === 503) {
    source = 'backend';
    code = 'SERVICE_UNAVAILABLE';
    message = `El servidor backend está iniciando o temporalmente no disponible (HTTP ${status}).`;
  } else if (status === 504) {
    source = 'backend';
    code = 'GATEWAY_TIMEOUT';
    message = `Tiempo de espera agotado al conectar con el servidor (HTTP 504).`;
  }

  return {
    ok: false,
    error: {
      code,
      message,
      source,
      requestId,
      status,
      endpoint,
    },
  };
}

async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = authService.getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, { ...options, headers });

  // Si expira el token, intenta refrescar y reintentar 1 vez
  if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
    const refreshed = await authService.refreshTokens();
    if (refreshed) {
      const newToken = authService.getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url, { ...options, headers });
      }
    }
  }

  return response;
}

export async function testBackendConnection(testText = 'Prueba de conexión'): Promise<{ success: boolean; data?: any; error?: StructuredApiError }> {
  const endpoint = API_CONFIG.ENDPOINTS.TEST;
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testText }),
    });
    const parsed = await safeParseResponse<{ success: boolean; message: string; receivedText: string; timestamp: string }>(response, endpoint);
    if (parsed.ok && parsed.data) {
      return { success: true, data: parsed.data };
    }
    return { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'No se pudo conectar con el servidor backend.',
        source: 'network',
        endpoint,
      },
    };
  }
}

export async function processAiText(params: AiProcessRequestParams): Promise<AiApiResponse> {
  const endpoint = API_CONFIG.ENDPOINTS.AI_PROCESS;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });

    const parsed = await safeParseResponse<AiApiResponse>(response, endpoint);
    if (!parsed.ok || !parsed.data) {
      return {
        success: false,
        error: parsed.error || {
          code: 'SERVER_ERROR',
          message: `Error HTTP ${response.status} al procesar con IA.`,
          source: 'backend',
          status: response.status,
          endpoint,
        },
      };
    }

    return parsed.data;
  } catch (error) {
    const isNetwork = error instanceof TypeError || (error instanceof Error && (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')));
    return {
      success: false,
      error: {
        code: isNetwork ? 'NETWORK_ERROR' : 'CLIENT_ERROR',
        message: isNetwork
          ? `No fue posible conectar con el servidor (${API_CONFIG.BASE_URL}). Verifica tu conexión o que el backend esté activo.`
          : (error instanceof Error ? error.message : 'Error inesperado al emitir la solicitud.'),
        source: isNetwork ? 'network' : 'frontend',
        endpoint,
      },
    };
  }
}

export interface RemoteHistoryItem {
  id: string;
  userId: string | null;
  action: string;
  originalText: string;
  resultText: string;
  tone: string;
  paraphraseLevel: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  createdAt: string;
}

export async function fetchRemoteHistory(limit = 20, offset = 0): Promise<{ success: boolean; data?: { items: RemoteHistoryItem[]; total: number; limit: number; offset: number }; error?: StructuredApiError }> {
  const endpoint = API_CONFIG.ENDPOINTS.HISTORY;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}?limit=${limit}&offset=${offset}`);
    const parsed = await safeParseResponse<{ success: boolean; data: { items: RemoteHistoryItem[]; total: number; limit: number; offset: number } }>(response, endpoint);
    if (parsed.ok && parsed.data) {
      return parsed.data;
    }
    return { success: false, error: parsed.error };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'No se pudo cargar el historial desde el servidor.',
        source: 'network',
        endpoint,
      },
    };
  }
}

export async function clearRemoteHistory(): Promise<{ success: boolean; error?: StructuredApiError }> {
  const endpoint = API_CONFIG.ENDPOINTS.HISTORY;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'DELETE',
    });
    const parsed = await safeParseResponse<{ success: boolean }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al limpiar historial.', source: 'network', endpoint },
    };
  }
}

export async function deleteRemoteHistoryItem(id: string): Promise<{ success: boolean; error?: StructuredApiError }> {
  const endpoint = `${API_CONFIG.ENDPOINTS.HISTORY}/${id}`;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'DELETE',
    });
    const parsed = await safeParseResponse<{ success: boolean }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al eliminar registro.', source: 'network', endpoint },
    };
  }
}

export interface RemoteLibraryItem {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  category?: { name: string };
  categoryName?: string;
  categoryIcon?: string;
  isShared: boolean;
  isFavorite: boolean;
  createdAt: string;
}

export async function fetchRemoteLibrary(): Promise<{ success: boolean; data?: RemoteLibraryItem[]; error?: StructuredApiError }> {
  const endpoint = API_CONFIG.ENDPOINTS.LIBRARY;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`);
    const parsed = await safeParseResponse<{ success: boolean; data: RemoteLibraryItem[] }>(response, endpoint);
    if (parsed.ok && parsed.data) {
      return parsed.data;
    }
    return { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al obtener biblioteca.', source: 'network', endpoint },
    };
  }
}

export async function createRemoteLibraryItem(item: { title: string; content: string; categoryId: string; isShared?: boolean; isFavorite?: boolean }): Promise<{ success: boolean; data?: RemoteLibraryItem; error?: StructuredApiError }> {
  const endpoint = API_CONFIG.ENDPOINTS.LIBRARY;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
    const parsed = await safeParseResponse<{ success: boolean; data: RemoteLibraryItem }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al guardar en biblioteca.', source: 'network', endpoint },
    };
  }
}

export async function updateRemoteLibraryItem(id: string, item: { title?: string; content?: string; categoryId?: string; isShared?: boolean; isFavorite?: boolean }): Promise<{ success: boolean; data?: RemoteLibraryItem; error?: StructuredApiError }> {
  const endpoint = `${API_CONFIG.ENDPOINTS.LIBRARY}/${id}`;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
    const parsed = await safeParseResponse<{ success: boolean; data: RemoteLibraryItem }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al actualizar biblioteca.', source: 'network', endpoint },
    };
  }
}

export interface RemoteCategory {
  id: string;
  name: string;
  description: string | null;
  icon?: string;
  itemCount: number;
}

export async function fetchRemoteCategories(): Promise<{ success: boolean; data?: RemoteCategory[]; error?: StructuredApiError }> {
  const endpoint = API_CONFIG.ENDPOINTS.CATEGORIES;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`);
    const parsed = await safeParseResponse<{ success: boolean; data: RemoteCategory[] }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al obtener categorías.', source: 'network', endpoint },
    };
  }
}

export interface QuickTextBackendItem {
  id: string;
  userId: string;
  title: string;
  header: string;
  body: string;
  solution?: string | null;
  isShared: boolean;
  isOwner?: boolean;
  ownerDisplayName?: string;
  createdAt: string;
  updatedAt: string;
}

export type RemoteQuickText = QuickTextBackendItem;

export async function fetchRemoteQuickTexts(): Promise<{ success: boolean; data?: QuickTextBackendItem[]; error?: StructuredApiError }> {
  const endpoint = API_CONFIG.ENDPOINTS.QUICK_TEXTS;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`);
    const parsed = await safeParseResponse<{ success: boolean; data: QuickTextBackendItem[] }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al obtener textos rápidos.', source: 'network', endpoint },
    };
  }
}

export async function createRemoteQuickText(item: { title: string; header: string; body: string; solution?: string; isShared?: boolean }): Promise<{ success: boolean; data?: QuickTextBackendItem; error?: StructuredApiError }> {
  const endpoint = API_CONFIG.ENDPOINTS.QUICK_TEXTS;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
    const parsed = await safeParseResponse<{ success: boolean; data: QuickTextBackendItem }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al crear texto rápido.', source: 'network', endpoint },
    };
  }
}

export async function updateRemoteQuickText(id: string, item: { title?: string; header?: string; body?: string; solution?: string; isShared?: boolean }): Promise<{ success: boolean; data?: QuickTextBackendItem; error?: StructuredApiError }> {
  const endpoint = `${API_CONFIG.ENDPOINTS.QUICK_TEXTS}/${id}`;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
    const parsed = await safeParseResponse<{ success: boolean; data: QuickTextBackendItem }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al actualizar texto rápido.', source: 'network', endpoint },
    };
  }
}

export async function deleteRemoteQuickText(id: string): Promise<{ success: boolean; error?: StructuredApiError }> {
  const endpoint = `${API_CONFIG.ENDPOINTS.QUICK_TEXTS}/${id}`;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'DELETE',
    });
    const parsed = await safeParseResponse<{ success: boolean }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al eliminar texto rápido.', source: 'network', endpoint },
    };
  }
}

export interface RemoteGuide {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  imagePath: string;
  imageUrl: string;
  createdById: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchRemoteGuides(query?: string): Promise<{ success: boolean; data?: RemoteGuide[]; error?: StructuredApiError }> {
  const queryParam = query ? `?q=${encodeURIComponent(query)}` : '';
  const endpoint = `${API_CONFIG.ENDPOINTS.GUIDES}${queryParam}`;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`);
    const parsed = await safeParseResponse<{ success: boolean; data: RemoteGuide[] }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al obtener las guías visuales.', source: 'network', endpoint },
    };
  }
}

export async function fetchRemoteGuideById(id: string): Promise<{ success: boolean; data?: RemoteGuide; error?: StructuredApiError }> {
  const endpoint = `${API_CONFIG.ENDPOINTS.GUIDES}/${id}`;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`);
    const parsed = await safeParseResponse<{ success: boolean; data: RemoteGuide }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al cargar la guía visual.', source: 'network', endpoint },
    };
  }
}

export async function createRemoteGuide(item: { title: string; description?: string; keywords: string[]; imageBase64: string }): Promise<{ success: boolean; data?: RemoteGuide; error?: StructuredApiError }> {
  const endpoint = API_CONFIG.ENDPOINTS.ADMIN_GUIDES;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
    const parsed = await safeParseResponse<{ success: boolean; data: RemoteGuide }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al crear la guía visual.', source: 'network', endpoint },
    };
  }
}

export async function updateRemoteGuide(id: string, item: { title?: string; description?: string; keywords?: string[]; imageBase64?: string }): Promise<{ success: boolean; data?: RemoteGuide; error?: StructuredApiError }> {
  const endpoint = `${API_CONFIG.ENDPOINTS.ADMIN_GUIDES}/${id}`;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'PATCH',
      body: JSON.stringify(item),
    });
    const parsed = await safeParseResponse<{ success: boolean; data: RemoteGuide }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al actualizar la guía visual.', source: 'network', endpoint },
    };
  }
}

export async function deleteRemoteGuide(id: string): Promise<{ success: boolean; error?: StructuredApiError }> {
  const endpoint = `${API_CONFIG.ENDPOINTS.ADMIN_GUIDES}/${id}`;
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'DELETE',
    });
    const parsed = await safeParseResponse<{ success: boolean }>(response, endpoint);
    return parsed.ok && parsed.data ? parsed.data : { success: false, error: parsed.error };
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de red al eliminar la guía visual.', source: 'network', endpoint },
    };
  }
}

