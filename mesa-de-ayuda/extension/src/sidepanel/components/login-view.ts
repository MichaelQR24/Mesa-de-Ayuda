import { authService } from '../services/auth-service';
import { showToast } from './toast';
import { navigationManager } from './navigation';
import { assistantView } from './assistant-view';

export class LoginView {
  private form!: HTMLFormElement;
  private emailInput!: HTMLInputElement;
  private passwordInput!: HTMLInputElement;
  private togglePasswordBtn!: HTMLButtonElement;
  private submitBtn!: HTMLButtonElement;

  init(): void {
    this.form = document.getElementById('form-login') as HTMLFormElement;
    this.emailInput = document.getElementById('login-email') as HTMLInputElement;
    this.passwordInput = document.getElementById('login-password') as HTMLInputElement;
    this.togglePasswordBtn = document.getElementById('btn-toggle-password') as HTMLButtonElement;
    this.submitBtn = document.getElementById('btn-submit-login') as HTMLButtonElement;

    this.togglePasswordBtn?.addEventListener('click', () => {
      const type = this.passwordInput.type === 'password' ? 'text' : 'password';
      this.passwordInput.type = type;
      this.togglePasswordBtn.textContent = type === 'password' ? '👁' : '🔒';
    });

    this.form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  }

  private async handleSubmit(): Promise<void> {
    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;

    if (!email || !password) {
      showToast('Por favor ingrese correo y contraseña', 'error');
      return;
    }

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = 'Iniciando sesión...';

    // Temporizador para advertir al usuario sobre el Cold Start de Render Free
    const coldStartTimer = setTimeout(() => {
      if (this.submitBtn.disabled) {
        this.submitBtn.textContent = 'Conectando con el servidor (iniciando)...';
        showToast('El servidor se está iniciando en la nube, por favor espera unos segundos...', 'info');
      }
    }, 3500);

    try {
      const result = await authService.login(email, password);

      if (!result.success || !result.user) {
        showToast(result.error || 'Credenciales incorrectas', 'error');
        return;
      }

      showToast(`¡Bienvenido, ${result.user.displayName}!`, 'success');
      this.passwordInput.value = '';

      if (result.user.mustChangePassword) {
        navigationManager.showChangePassword();
      } else {
        navigationManager.showAuthenticatedApp();
        // Cargar selección pendiente si el usuario venía de un clic derecho antes del login
        await assistantView.checkPendingSelection();
      }
    } catch {
      showToast('No se pudo conectar con el servidor. Verifica tu conexión a Internet.', 'error');
    } finally {
      clearTimeout(coldStartTimer);
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = 'Iniciar sesión';
    }
  }
}

export const loginView = new LoginView();

