import { API_CONFIG } from '../config/api';

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'USER';
  mustChangePassword: boolean;
}

async function safeJsonParse(response: Response): Promise<{ ok: boolean; data?: any; error?: string }> {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return { ok: response.ok, data: json };
  } catch {
    if (response.status === 404) {
      return { ok: false, error: `No se encontró el servicio en ${API_CONFIG.BASE_URL} (HTTP 404). Verifica que la URL del backend en Render sea correcta.` };
    }
    if (response.status === 502 || response.status === 503) {
      return { ok: false, error: `El servidor en ${API_CONFIG.BASE_URL} está iniciando o no disponible temporalmente (HTTP ${response.status}). Intenta en unos segundos.` };
    }
    return { ok: false, error: text || `Error de comunicación con el servidor (HTTP ${response.status})` };
  }
}

export class AuthService {
  private accessToken: string | null = null;
  private currentUser: UserSession | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  async init(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        if (chrome.storage.session) {
          const sessionData = await chrome.storage.session.get(['accessToken', 'user']) as { accessToken?: string; user?: UserSession };
          if (sessionData.accessToken) {
            this.accessToken = sessionData.accessToken;
          }
          if (sessionData.user) {
            this.currentUser = sessionData.user;
          }
        }

        if (!this.accessToken) {
          const localData = await chrome.storage.local.get(['refreshToken', 'user']) as { refreshToken?: string; user?: UserSession };
          if (localData.refreshToken) {
            if (localData.user) this.currentUser = localData.user;
            await this.refreshTokens();
          }
        }
      }
    } catch {
      // Ignora errores iniciales
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

      if (typeof chrome !== 'undefined' && chrome.storage) {
        if (chrome.storage.session) {
          await chrome.storage.session.set({
            accessToken: this.accessToken,
            user: this.currentUser,
          });
        }
        if (chrome.storage.local) {
          await chrome.storage.local.set({
            refreshToken: parsed.data.data.refreshToken,
            user: this.currentUser,
          });
        }
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
    // Si ya existe una llamada de refresco en curso, retornar la misma promesa (Request Coalescing)
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          return false;
        }

        const { refreshToken } = (await chrome.storage.local.get(['refreshToken'])) as { refreshToken?: string };
        if (!refreshToken) return false;

        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_REFRESH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        const parsed = await safeJsonParse(response);

        if (!parsed.ok || !parsed.data || !parsed.data.success) {
          await this.logout();
          return false;
        }

        this.accessToken = parsed.data.data.accessToken;

        if (chrome.storage.session) {
          await chrome.storage.session.set({ accessToken: this.accessToken });
        }
        if (chrome.storage.local) {
          await chrome.storage.local.set({ refreshToken: parsed.data.data.refreshToken });
        }

        return true;
      } catch {
        await this.logout();
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

      if (typeof chrome !== 'undefined' && chrome.storage) {
        if (chrome.storage.session) {
          await chrome.storage.session.set({
            accessToken: this.accessToken,
            user: this.currentUser,
          });
        }
        if (chrome.storage.local) {
          await chrome.storage.local.set({
            refreshToken: parsed.data.data.refreshToken,
            user: this.currentUser,
          });
        }
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

      if (typeof chrome !== 'undefined' && chrome.storage) {
        if (chrome.storage.session) {
          await chrome.storage.session.remove(['accessToken', 'user']).catch(() => {});
        }
        if (chrome.storage.local) {
          await chrome.storage.local.remove(['refreshToken', 'user']).catch(() => {});
        }
      }
    }
  }
}

export const authService = new AuthService();
