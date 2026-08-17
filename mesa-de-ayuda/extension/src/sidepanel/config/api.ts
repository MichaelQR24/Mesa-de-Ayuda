export const API_CONFIG = {
  BASE_URL: 'http://localhost:3000',
  ENDPOINTS: {
    HEALTH: '/health',
    TEST: '/api/v1/test',
    AUTH_LOGIN: '/api/v1/auth/login',
    AUTH_REFRESH: '/api/v1/auth/refresh',
    AUTH_LOGOUT: '/api/v1/auth/logout',
    AUTH_ME: '/api/v1/auth/me',
    AUTH_CHANGE_PASSWORD: '/api/v1/auth/change-password',
    AI_PROCESS: '/api/v1/ai/process',
    HISTORY: '/api/v1/history',
    LIBRARY: '/api/v1/library',
    CATEGORIES: '/api/v1/categories',
    ADMIN_USERS: '/api/v1/admin/users',
  },
} as const;
