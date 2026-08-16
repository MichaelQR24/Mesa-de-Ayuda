/**
 * Configuración centralizada de endpoints de API
 * Permite cambiar la URL base fácilmente entre entornos (local / producción)
 */
export const API_CONFIG = {
  BASE_URL: 'http://localhost:3000',
  ENDPOINTS: {
    HEALTH: '/health',
    TEST: '/api/v1/test',
  },
} as const;
