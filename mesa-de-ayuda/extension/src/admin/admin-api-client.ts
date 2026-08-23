import { API_CONFIG } from '../sidepanel/config/api';
import { authService } from '../sidepanel/services/auth-service';

async function adminFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: { code?: string; message?: string } }> {
  try {
    const token = authService.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      const refreshed = await authService.refreshTokens();
      if (refreshed) {
        const newToken = authService.getAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(url, { ...options, headers });
        }
      }
    }

    const json = await response.json();
    return json;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Error de conexión con el servidor backend.',
      },
    };
  }
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'INACTIVE';
  mustChangePassword: boolean;
  monthlyTokenLimit: number | null;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryData {
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  library: {
    sharedTotal: number;
  };
  usage: {
    requestsToday: number;
    requestsMonth: number;
    inputTokensMonth: number;
    outputTokensMonth: number;
    totalTokensMonth: number;
    avgTokensPerRequest: number;
    estimatedCostUsd: number;
  };
}

export interface UserUsageMetric {
  userId: string;
  displayName: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'INACTIVE';
  monthlyTokenLimit: number | null;
  requestsToday: number;
  requestsMonth: number;
  inputTokensMonth: number;
  outputTokensMonth: number;
  totalTokensMonth: number;
  percentageUsed: number | null;
  estimatedCostUsd: number;
}

export interface SharedTemplate {
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
  user?: {
    id: string;
    displayName: string;
    email: string;
  };
}

export interface AuditItem {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  actor: {
    id: string;
    displayName: string;
    email: string;
    role: string;
  };
}

export const adminApiClient = {
  // Resumen general
  getSummary: () => adminFetch<SummaryData>(`${API_CONFIG.BASE_URL}/api/v1/admin/usage/summary`),

  // Usuarios
  getUsers: (params?: { search?: string; role?: string; status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.append('search', params.search);
    if (params?.role) qs.append('role', params.role);
    if (params?.status) qs.append('status', params.status);
    if (params?.limit) qs.append('limit', String(params.limit));
    if (params?.offset) qs.append('offset', String(params.offset));
    const url = `${API_CONFIG.BASE_URL}/api/v1/admin/users${qs.toString() ? `?${qs.toString()}` : ''}`;
    return adminFetch<{ items: AdminUser[]; total: number }>(url);
  },

  createUser: (data: { email: string; displayName: string; temporaryPassword: string; role: string; monthlyTokenLimit?: number | null }) =>
    adminFetch<AdminUser>(`${API_CONFIG.BASE_URL}/api/v1/admin/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: { displayName?: string; role?: 'ADMIN' | 'USER' }) =>
    adminFetch<AdminUser>(`${API_CONFIG.BASE_URL}/api/v1/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateUserStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    adminFetch<AdminUser>(`${API_CONFIG.BASE_URL}/api/v1/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  resetPassword: (id: string, temporaryPassword: string) =>
    adminFetch<{ message: string; user: AdminUser }>(`${API_CONFIG.BASE_URL}/api/v1/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ temporaryPassword }),
    }),

  updateUsageLimit: (id: string, monthlyTokenLimit: number | null) =>
    adminFetch<AdminUser>(`${API_CONFIG.BASE_URL}/api/v1/admin/users/${id}/usage-limit`, {
      method: 'PATCH',
      body: JSON.stringify({ monthlyTokenLimit }),
    }),

  // Consumo
  getUserUsageList: () => adminFetch<UserUsageMetric[]>(`${API_CONFIG.BASE_URL}/api/v1/admin/usage/users`),

  // Biblioteca Compartida
  getSharedLibrary: () => adminFetch<SharedTemplate[]>(`${API_CONFIG.BASE_URL}/api/v1/admin/library`),

  createSharedTemplate: (data: { title: string; content: string; categoryId: string; isFavorite?: boolean }) =>
    adminFetch<SharedTemplate>(`${API_CONFIG.BASE_URL}/api/v1/admin/library`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSharedTemplate: (id: string, data: { title?: string; content?: string; categoryId?: string; isFavorite?: boolean }) =>
    adminFetch<SharedTemplate>(`${API_CONFIG.BASE_URL}/api/v1/admin/library/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteSharedTemplate: (id: string) =>
    adminFetch<{ message: string }>(`${API_CONFIG.BASE_URL}/api/v1/admin/library/${id}`, {
      method: 'DELETE',
    }),

  // Actividad / Auditoría
  getAuditLogs: (params?: { action?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.action) qs.append('action', params.action);
    if (params?.limit) qs.append('limit', String(params.limit));
    if (params?.offset) qs.append('offset', String(params.offset));
    const url = `${API_CONFIG.BASE_URL}/api/v1/admin/audit${qs.toString() ? `?${qs.toString()}` : ''}`;
    return adminFetch<{ items: AuditItem[]; total: number; limit: number; offset: number }>(url);
  },

  // Sesiones
  getSessionsSummary: () => adminFetch<{ activeSessions: number; revokedSessions: number }>(`${API_CONFIG.BASE_URL}/api/v1/admin/sessions/summary`),

  revokeUserSessions: (userId: string) =>
    adminFetch<{ message: string }>(`${API_CONFIG.BASE_URL}/api/v1/admin/sessions/users/${userId}/revoke-sessions`, {
      method: 'POST',
    }),

  // Categorías
  getCategories: () => adminFetch<Array<{ id: string; name: string }>>(`${API_CONFIG.BASE_URL}/api/v1/categories`),

  // Estado del Sistema / Monitoreo
  getSystemHealth: async (): Promise<{ success: boolean; data?: SystemHealthData; error?: { code?: string; message?: string } }> => {
    const raw = (await adminFetch<any>(`${API_CONFIG.BASE_URL}/api/v1/admin/system/health`)) as Record<string, any>;
    if (raw && (raw.success || raw.status)) {
      const data: SystemHealthData = raw.version ? (raw as unknown as SystemHealthData) : (raw.data || raw);
      return { success: true, data };
    }
    return {
      success: false,
      error: raw?.error || { message: 'Error al consultar estado del sistema' },
    };
  },
};

export interface SystemHealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: {
    backend: string;
  };
  environment: string;
  uptimeSeconds: number;
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
  };
  database: {
    status: 'connected' | 'slow' | 'disconnected';
    latencyMs: number;
  };
  ai: {
    status: string;
    model: string;
    requestsToday: number;
    requestsMonth: number;
    totalTokensMonth: number;
    estimatedCostUsd: number | string;
  };
  timestamp: string;
}
