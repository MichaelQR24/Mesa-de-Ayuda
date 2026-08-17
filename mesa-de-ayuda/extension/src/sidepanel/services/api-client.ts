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

    const data = await response.json();
    return data as AiApiResponse;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'No se pudo conectar con el servidor backend (http://localhost:3000).',
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

export interface RemoteCategory {
  id: string;
  name: string;
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

export async function fetchRemoteHistory(limit = 30, offset = 0): Promise<{ success: boolean; data?: { items: RemoteHistoryItem[]; total: number }; error?: { message: string } }> {
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HISTORY}?limit=${limit}&offset=${offset}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export async function fetchRemoteCategories(): Promise<{ success: boolean; data?: RemoteCategory[]; error?: { message: string } }> {
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CATEGORIES}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export async function fetchRemoteLibrary(filters?: { categoryId?: string; isShared?: boolean; isFavorite?: boolean }): Promise<{ success: boolean; data?: RemoteLibraryItem[]; error?: { message: string } }> {
  try {
    const params = new URLSearchParams();
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (typeof filters?.isShared === 'boolean') params.append('isShared', String(filters.isShared));
    if (typeof filters?.isFavorite === 'boolean') params.append('isFavorite', String(filters.isFavorite));

    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LIBRARY}${qs}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export async function createRemoteLibraryItem(data: { title: string; content: string; categoryId: string; isShared?: boolean; isFavorite?: boolean }): Promise<{ success: boolean; data?: RemoteLibraryItem; error?: { message: string } }> {
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LIBRARY}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export async function updateRemoteLibraryItem(id: string, data: { isFavorite?: boolean; title?: string; content?: string; categoryId?: string }): Promise<{ success: boolean; data?: RemoteLibraryItem; error?: { message: string } }> {
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LIBRARY}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: { message: error instanceof Error ? error.message : 'Error de red' } };
  }
}

export async function deleteRemoteLibraryItem(id: string): Promise<{ success: boolean; error?: { message: string } }> {
  try {
    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LIBRARY}/${id}`, {
      method: 'DELETE',
    });
    return await response.json();
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
    return await response.json();
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

    const data = await response.json();
    return data as TestApiResponse;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'No se pudo conectar con el servidor backend (http://localhost:3000).',
      },
    };
  }
}
