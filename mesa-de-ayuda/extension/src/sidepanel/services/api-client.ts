import { API_CONFIG } from '../config/api';

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
