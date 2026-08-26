const resolveBaseUrl = (): string => {
  const metaEnv = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env;
  const envUrl = metaEnv?.VITE_API_BASE_URL;
  return (envUrl && typeof envUrl === 'string' && envUrl.trim())
    ? envUrl.trim()
    : 'https://mesa-de-ayuda-j6uw.onrender.com';
};

export const API_CONFIG = {
  BASE_URL: resolveBaseUrl(),
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
    QUICK_TEXTS: '/api/v1/quick-texts',
    GUIDES: '/api/v1/guides',
    ADMIN_USERS: '/api/v1/admin/users',
    ADMIN_GUIDES: '/api/v1/admin/guides',
  },
} as const;
