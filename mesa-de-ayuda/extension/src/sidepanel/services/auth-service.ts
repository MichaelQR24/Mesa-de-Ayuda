import { API_CONFIG } from '../config/api';

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'USER';
  mustChangePassword: boolean;
}

export class AuthService {
  private accessToken: string | null = null;
  private currentUser: UserSession | null = null;

  async init(): Promise<void> {
    // Restaurar sesión desde storage si existe
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // Intenta leer access token de session storage
        if (chrome.storage.session) {
          const sessionData = await chrome.storage.session.get(['accessToken', 'user']) as { accessToken?: string; user?: UserSession };
          if (sessionData.accessToken) {
            this.accessToken = sessionData.accessToken;
          }
          if (sessionData.user) {
            this.currentUser = sessionData.user;
          }
        }

        // Si no hay access token en session, intenta restaurar con refresh token de local storage
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

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error?.message || 'Credenciales incorrectas.',
        };
      }

      this.accessToken = data.data.accessToken;
      this.currentUser = data.data.user;

      // Guardar en storage seguro de Chrome
      if (typeof chrome !== 'undefined' && chrome.storage) {
        if (chrome.storage.session) {
          await chrome.storage.session.set({
            accessToken: this.accessToken,
            user: this.currentUser,
          });
        }
        if (chrome.storage.local) {
          await chrome.storage.local.set({
            refreshToken: data.data.refreshToken,
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

      const data = await response.json();

      if (!response.ok || !data.success) {
        await this.clearLocalSession();
        return false;
      }

      this.accessToken = data.data.accessToken;

      if (chrome.storage.session) {
        await chrome.storage.session.set({
          accessToken: this.accessToken,
          user: this.currentUser,
        });
      }
      await chrome.storage.local.set({
        refreshToken: data.data.refreshToken,
      });

      return true;
    } catch {
      return false;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const token = this.accessToken;
      if (!token) return { success: false, error: 'No autenticado' };

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_CHANGE_PASSWORD}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error?.message || 'Error al cambiar contraseña.',
        };
      }

      if (this.currentUser) {
        this.currentUser.mustChangePassword = false;
        if (typeof chrome !== 'undefined' && chrome.storage) {
          if (chrome.storage.session) await chrome.storage.session.set({ user: this.currentUser });
          if (chrome.storage.local) await chrome.storage.local.set({ user: this.currentUser });
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de red.',
      };
    }
  }

  async logout(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const { refreshToken } = (await chrome.storage.local.get(['refreshToken'])) as { refreshToken?: string };
        if (refreshToken) {
          await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_LOGOUT}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          }).catch(() => {});
        }
      }
    } finally {
      await this.clearLocalSession();
    }
  }

  private async clearLocalSession(): Promise<void> {
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

export const authService = new AuthService();
