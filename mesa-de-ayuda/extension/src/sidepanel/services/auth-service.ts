import { API_CONFIG } from '../config/api';

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'USER';
  mustChangePassword: boolean;
}

interface StoredAuthData {
  accessToken?: string;
  refreshToken?: string;
  user?: UserSession;
  tokenExpiresAt?: number;
}

function parseJwtExpiration(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload && typeof payload.exp === 'number') {
      return payload.exp * 1000; // ms
    }
    return null;
  } catch {
    return null;
  }
}

async function safeJsonParse(response: Response): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return { ok: response.ok, status: response.status, data: json };
  } catch {
    if (response.status === 404) {
      return { ok: false, status: 404, error: `No se encontró el servicio en ${API_CONFIG.BASE_URL} (HTTP 404). Verifica la URL del backend.` };
    }
    if (response.status === 502 || response.status === 503) {
      return { ok: false, status: response.status, error: `El servidor backend está iniciando o en reposo (HTTP ${response.status}). Intenta en unos momentos.` };
    }
    return { ok: false, status: response.status, error: text || `Error de comunicación con el servidor (HTTP ${response.status})` };
  }
}

export class AuthService {
  private accessToken: string | null = null;
  private currentUser: UserSession | null = null;
  private tokenExpiresAt: number | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  async init(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = (await chrome.storage.local.get(['accessToken', 'refreshToken', 'user', 'tokenExpiresAt'])) as StoredAuthData;

        if (stored.user) {
          this.currentUser = stored.user;
        }

        if (stored.accessToken) {
          this.accessToken = stored.accessToken;
          this.tokenExpiresAt = stored.tokenExpiresAt || parseJwtExpiration(stored.accessToken);
        }

        const now = Date.now();
        // Margen de seguridad: si expira en menos de 60 segundos o ya expiró
        const isAccessTokenExpired = !this.accessToken || !this.tokenExpiresAt || this.tokenExpiresAt - now < 60000;

        if (isAccessTokenExpired && stored.refreshToken) {
          await this.refreshTokens();
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error durante la inicialización de sesión:', err);
    }
  }

  getUser(): UserSession | null {
    return this.currentUser;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.currentUser;
  }

  async login(email: string, password: string): Promise<{ success: boolean; user?: UserSession; error?: string }> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_LOGIN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const parsed = await safeJsonParse(response);

      if (!parsed.ok || !parsed.data || !parsed.data.success) {
        return {
          success: false,
          error: parsed.data?.error?.message || parsed.error || 'Credenciales incorrectas.',
        };
      }

      this.accessToken = parsed.data.data.accessToken;
      this.currentUser = parsed.data.data.user;
      this.tokenExpiresAt = parseJwtExpiration(this.accessToken) || (Date.now() + 15 * 60 * 1000);

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          accessToken: this.accessToken,
          refreshToken: parsed.data.data.refreshToken,
          user: this.currentUser,
          tokenExpiresAt: this.tokenExpiresAt,
        });
      }

      return {
        success: true,
        user: this.currentUser || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo conectar con el servidor backend.',
      };
    }
  }

  async refreshTokens(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          return false;
        }

        const { refreshToken } = (await chrome.storage.local.get(['refreshToken'])) as { refreshToken?: string };
        if (!refreshToken) {
          return false;
        }

        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_REFRESH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        const parsed = await safeJsonParse(response);

        if (!parsed.ok || !parsed.data || !parsed.data.success) {
          // Solo hacer logout si el backend rechaza explícitamente el token con 401/403
          if (parsed.status === 401 || parsed.status === 403) {
            await this.logout();
          }
          return false;
        }

        this.accessToken = parsed.data.data.accessToken;
        this.tokenExpiresAt = parseJwtExpiration(this.accessToken) || (Date.now() + 15 * 60 * 1000);

        if (parsed.data.data.user) {
          this.currentUser = parsed.data.data.user;
        }

        await chrome.storage.local.set({
          accessToken: this.accessToken,
          refreshToken: parsed.data.data.refreshToken,
          user: this.currentUser,
          tokenExpiresAt: this.tokenExpiresAt,
        });

        return true;
      } catch (networkErr) {
        // En caso de fallo de red transitorio o servidor apagado, NO eliminamos la sesión local
        console.warn('[AuthService] Fallo transitorio al refrescar token (reintentará más tarde):', networkErr);
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.accessToken) {
        return { success: false, error: 'No autenticado.' };
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_CHANGE_PASSWORD}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const parsed = await safeJsonParse(response);

      if (!parsed.ok || !parsed.data || !parsed.data.success) {
        return {
          success: false,
          error: parsed.data?.error?.message || parsed.error || 'Error al cambiar contraseña.',
        };
      }

      this.accessToken = parsed.data.data.accessToken;
      this.currentUser = parsed.data.data.user;
      this.tokenExpiresAt = parseJwtExpiration(this.accessToken) || (Date.now() + 15 * 60 * 1000);

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          accessToken: this.accessToken,
          refreshToken: parsed.data.data.refreshToken,
          user: this.currentUser,
          tokenExpiresAt: this.tokenExpiresAt,
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al conectar con el servidor.',
      };
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_LOGOUT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
        }).catch(() => {});
      }
    } finally {
      this.accessToken = null;
      this.currentUser = null;
      this.tokenExpiresAt = null;

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(['accessToken', 'refreshToken', 'user', 'tokenExpiresAt']).catch(() => {});
      }
    }
  }
}

export const authService = new AuthService();
