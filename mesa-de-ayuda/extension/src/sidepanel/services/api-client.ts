import { API_CONFIG } from '../config/api';
import { authService } from './auth-service';

export interface TestApiResponse {
  success: boolean;
  data?: {
    receivedText: string;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface AiApiUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AiApiResponse {
  success: boolean;
  data?: {
    result: string;
    model: string;
    usage?: AiApiUsage;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface AiProcessRequestParams {
  text: string;
  action: 'correct' | 'paraphrase' | 'professionalize' | 'summarize' | 'reply';
  tone?: 'professional' | 'formal' | 'friendly' | 'technical' | 'casual';
  paraphraseLevel?: 'soft' | 'medium' | 'complete';
  redactSensitiveData?: boolean;
}

async function safeParseJson<T>(response: Response): Promise<{ ok: boolean; data?: T; error?: string }> {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return { ok: response.ok, data: json as T };
  } catch {
    if (response.status === 404) {
      return { ok: false, error: `No se encontró el servicio en ${API_CONFIG.BASE_URL} (HTTP 404). Verifica que la URL del backend en Render sea correcta.` };
    }
    if (response.status === 502 || response.status === 503) {
      return { ok: false, error: `El servidor en ${API_CONFIG.BASE_URL} está iniciando o no disponible temporalmente (HTTP ${response.status}).` };
    }
    return { ok: false, error: text || `Error de servidor HTTP ${response.status}` };
  }
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

export async function processAiText(params: AiProcessRequestParams): Promise<AiApiResponse> {
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AI_PROCESS}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });

    const parsed = await safeParseJson<AiApiResponse>(response);
    if (!parsed.ok || !parsed.data) {
      return {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: parsed.error || `Error HTTP ${response.status} al procesar con IA.`,
        },
      };
    }

    return parsed.data;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : `No se pudo conectar con el servidor backend (${API_CONFIG.BASE_URL}).`,
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

export async function fetchRemoteHistory(limit = 20, offset = 0): Promise<{ success: boolean; data?: { items: RemoteHistoryItem[]; total: number; limit: number; offset: number }; error?: { message?: string } }> {
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HISTORY}?limit=${limit}&offset=${offset}`);
    const parsed = await safeParseJson<{ success: boolean; data: any; error?: { message?: string } }>(response);
    return parsed.data || { success: false, error: { message: parsed.error } };
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export interface RemoteCategory {
  id: string;
  name: string;
  createdAt: string;
}

let cachedCategories: RemoteCategory[] | null = null;
let categoriesCacheTime = 0;
const CATEGORIES_TTL_MS = 5 * 60 * 1000; // 5 minutos

export async function fetchRemoteCategories(forceRefresh = false): Promise<{ success: boolean; data?: RemoteCategory[]; error?: { message?: string } }> {
  if (!forceRefresh && cachedCategories && Date.now() - categoriesCacheTime < CATEGORIES_TTL_MS) {
    return { success: true, data: cachedCategories };
  }

  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CATEGORIES}`);
    const parsed = await safeParseJson<{ success: boolean; data: RemoteCategory[]; error?: { message?: string } }>(response);

    if (parsed.data && parsed.data.success && Array.isArray(parsed.data.data)) {
      cachedCategories = parsed.data.data;
      categoriesCacheTime = Date.now();
      return { success: true, data: cachedCategories };
    }

    return parsed.data || { success: false, error: { message: parsed.error } };
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export interface RemoteLibraryItem {
  id: string;
  userId: string | null;
  categoryId: string;
  title: string;
  content: string;
  isShared: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
  };
}

export async function fetchRemoteLibrary(params?: { categoryId?: string; isShared?: boolean; isFavorite?: boolean }): Promise<{ success: boolean; data?: RemoteLibraryItem[]; error?: { message?: string } }> {
  try {
    const query = new URLSearchParams();
    if (params?.categoryId) query.append('categoryId', params.categoryId);
    if (params?.isShared !== undefined) query.append('isShared', String(params.isShared));
    if (params?.isFavorite !== undefined) query.append('isFavorite', String(params.isFavorite));

    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LIBRARY}?${query.toString()}`);
    const parsed = await safeParseJson<{ success: boolean; data: RemoteLibraryItem[]; error?: { message?: string } }>(response);
    return parsed.data || { success: false, error: { message: parsed.error } };
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export async function createRemoteLibraryItem(item: { title: string; content: string; categoryId: string; isShared?: boolean; isFavorite?: boolean }): Promise<{ success: boolean; data?: RemoteLibraryItem; error?: { message?: string } }> {
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LIBRARY}`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
    const parsed = await safeParseJson<{ success: boolean; data: RemoteLibraryItem; error?: { message?: string } }>(response);
    return parsed.data || { success: false, error: { message: parsed.error } };
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export async function updateRemoteLibraryItem(id: string, updates: { title?: string; content?: string; categoryId?: string; isShared?: boolean; isFavorite?: boolean }): Promise<{ success: boolean; data?: RemoteLibraryItem; error?: { message?: string } }> {
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LIBRARY}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    const parsed = await safeParseJson<{ success: boolean; data: RemoteLibraryItem; error?: { message?: string } }>(response);
    return parsed.data || { success: false, error: { message: parsed.error } };
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export async function deleteRemoteLibraryItem(id: string): Promise<{ success: boolean; data?: { message: string }; error?: { message?: string } }> {
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LIBRARY}/${id}`, {
      method: 'DELETE',
    });
    const parsed = await safeParseJson<{ success: boolean; data: { message: string }; error?: { message?: string } }>(response);
    return parsed.data || { success: false, error: { message: parsed.error } };
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export async function updatePrivacyPreferences(saveAiHistory: boolean): Promise<{ success: boolean; data?: any; error?: { message?: string } }> {
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}/api/v1/auth/privacy`, {
      method: 'PATCH',
      body: JSON.stringify({ saveAiHistory }),
    });
    const parsed = await safeParseJson<{ success: boolean; data: any; error?: { message?: string } }>(response);
    return parsed.data || { success: false, error: { message: parsed.error } };
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export async function testBackendConnection(text = 'Prueba de conexión desde Side Panel'): Promise<TestApiResponse> {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TEST}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    const parsed = await safeParseJson<TestApiResponse>(response);
    return parsed.data || { success: false, error: { code: 'HTTP_ERROR', message: parsed.error || `HTTP ${response.status}` } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : `No se pudo conectar con el servidor backend (${API_CONFIG.BASE_URL}).`,
      },
    };
  }
}
