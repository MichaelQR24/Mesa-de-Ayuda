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

export type ConnectionState = 'connected' | 'connecting' | 'offline';

function parseJwtExpiration(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload && typeof payload.exp === 'number') {
      return payload.exp * 1000; // milisegundos
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
      return { ok: false, status: 404, error: `No se encontró el servicio en ${API_CONFIG.BASE_URL} (HTTP 404).` };
    }
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      return { ok: false, status: response.status, error: `El servidor backend está iniciando o en reposo (HTTP ${response.status}).` };
    }
    return { ok: false, status: response.status, error: text || `Error de comunicación con el servidor (HTTP ${response.status})` };
  }
}

export class AuthService {
  private accessToken: string | null = null;
  private currentUser: UserSession | null = null;
  private tokenExpiresAt: number | null = null;
  private hasRefreshTokenFlag = false;
  private refreshPromise: Promise<boolean> | null = null;
  private connectionState: ConnectionState = 'connected';
  private connectionListeners: Array<(state: ConnectionState) => void> = [];

  /**
   * Inicialización rápida (Fast Path)
   * Lee chrome.storage.local de forma síncrona/inmediata y restaura la sesión en memoria.
   * NO bloquea la interfaz con llamadas de red.
   */
  async init(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = (await chrome.storage.local.get([
          'accessToken',
          'refreshToken',
          'user',
          'tokenExpiresAt',
        ])) as StoredAuthData;

        if (stored.user) {
          this.currentUser = stored.user;
        }

        if (stored.accessToken) {
          this.accessToken = stored.accessToken;
          this.tokenExpiresAt = stored.tokenExpiresAt || parseJwtExpiration(stored.accessToken);
        }

        this.hasRefreshTokenFlag = Boolean(stored.refreshToken);

        const now = Date.now();
        const isAccessTokenExpired =
          !this.accessToken || !this.tokenExpiresAt || this.tokenExpiresAt - now < 60000;

        // Si el accessToken está vencido pero tenemos refreshToken, lanzamos refresh en segundo plano NO bloqueante
        if (isAccessTokenExpired && this.hasRefreshTokenFlag) {
          this.setConnectionState('connecting');
          // Disparar en segundo plano sin await
          this.refreshTokens()
            .then((refreshed) => {
              this.setConnectionState(refreshed ? 'connected' : 'offline');
            })
            .catch(() => {
              this.setConnectionState('offline');
            });
        } else if (this.currentUser) {
          this.setConnectionState('connected');
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error restaurando sesión local:', err);
    }
  }

  onConnectionStateChange(listener: (state: ConnectionState) => void): void {
    this.connectionListeners.push(listener);
    listener(this.connectionState);
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.connectionListeners.forEach((fn) => {
      try {
        fn(state);
      } catch {}
    });
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getUser(): UserSession | null {
    return this.currentUser;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Comprueba si existe una sesión válida (activa o recuperable localmente)
   */
  isAuthenticated(): boolean {
    return !!this.currentUser && (!!this.accessToken || this.hasRefreshTokenFlag);
  }

  /**
   * Comprueba si el accessToken en memoria sigue vigente
   */
  isAccessTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiresAt) return false;
    return this.tokenExpiresAt > Date.now() + 10000; // 10 segundos de margen
  }

  async login(email: string, password: string): Promise<{ success: boolean; user?: UserSession; error?: string }> {
    try {
      this.setConnectionState('connecting');
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_LOGIN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const parsed = await safeJsonParse(response);

      if (!parsed.ok || !parsed.data || !parsed.data.success) {
        this.setConnectionState('offline');
        return {
          success: false,
          error: parsed.data?.error?.message || parsed.error || 'Credenciales incorrectas.',
        };
      }

      this.accessToken = parsed.data.data.accessToken;
      this.currentUser = parsed.data.data.user;
      this.tokenExpiresAt = parseJwtExpiration(this.accessToken) || (Date.now() + 15 * 60 * 1000);
      this.hasRefreshTokenFlag = true;
      this.setConnectionState('connected');

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
      this.setConnectionState('offline');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo conectar con el servidor backend.',
      };
    }
  }

  /**
   * Refresco de tokens con Request Coalescing
   * Múltiples llamadas simultáneas esperan la misma promesa activa.
   */
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

        this.setConnectionState('connecting');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout para soportar cold starts

        let response: Response;
        try {
          response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_REFRESH}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const parsed = await safeJsonParse(response);

        if (!parsed.ok || !parsed.data || !parsed.data.success) {
          // SOLO invalidar sesión si el backend responde con error definitivo de autenticación
          if (parsed.status === 401 || parsed.status === 403) {
            const errCode = parsed.data?.error?.code;
            if (
              errCode === 'UNAUTHORIZED' ||
              errCode === 'FORBIDDEN' ||
              errCode === 'TOKEN_EXPIRED' ||
              errCode === 'TOKEN_REVOKED' ||
              errCode === 'USER_INACTIVE' ||
              errCode === 'TOKEN_REUSE_DETECTED' ||
              parsed.status === 401
            ) {
              console.warn('[AuthService] Token de refresco rechazado definitivamente por el servidor. Cerrando sesión.');
              await this.logout();
              return false;
            }
          }

          // En caso de 500, 502, 503, 504 o cold start temporal: NO cerrará sesión
          console.warn(`[AuthService] Respuesta temporal del servidor (HTTP ${parsed.status}). Conservando sesión local.`);
          this.setConnectionState('offline');
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

        this.setConnectionState('connected');
        return true;
      } catch (networkErr) {
        // En caso de fallo de red transitorio, cold start o timeout, CONSERVAR la sesión local
        console.warn('[AuthService] Fallo transitorio de conexión al refrescar token. La sesión local se mantiene intacta:', networkErr);
        this.setConnectionState('offline');
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

  /**
   * Cierre voluntario de sesión.
   * Notifica al backend y limpia de forma segura el almacenamiento local.
   */
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
      this.hasRefreshTokenFlag = false;
      this.setConnectionState('connected');

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(['accessToken', 'refreshToken', 'user', 'tokenExpiresAt']).catch(() => {});
      }
    }
  }
}

export const authService = new AuthService();
