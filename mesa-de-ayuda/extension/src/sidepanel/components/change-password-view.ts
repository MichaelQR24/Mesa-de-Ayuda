import { authService } from '../services/auth-service';
import { showToast } from './toast';
import { navigationManager } from './navigation';

export class ChangePasswordView {
  private form!: HTMLFormElement;
  private currentPasswordInput!: HTMLInputElement;
  private newPasswordInput!: HTMLInputElement;
  private confirmNewPasswordInput!: HTMLInputElement;
  private submitBtn!: HTMLButtonElement;

  init(): void {
    this.form = document.getElementById('form-change-password') as HTMLFormElement;
    this.currentPasswordInput = document.getElementById('current-password') as HTMLInputElement;
    this.newPasswordInput = document.getElementById('new-password') as HTMLInputElement;
    this.confirmNewPasswordInput = document.getElementById('confirm-new-password') as HTMLInputElement;
    this.submitBtn = document.getElementById('btn-submit-change-password') as HTMLButtonElement;

    this.form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  }

  private async handleSubmit(): Promise<void> {
    const currentPassword = this.currentPasswordInput.value;
    const newPassword = this.newPasswordInput.value;
    const confirmNewPassword = this.confirmNewPasswordInput.value;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showToast('Todos los campos son obligatorios', 'error');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showToast('La nueva contraseña y la confirmación no coinciden', 'error');
      return;
    }

    if (newPassword.length < 10 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      showToast('La nueva contraseña debe tener mín. 10 caracteres, 1 letra y 1 número', 'error');
      return;
    }

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = 'Actualizando...';

    try {
      const result = await authService.changePassword(currentPassword, newPassword);

      if (!result.success) {
        showToast(result.error || 'No se pudo actualizar la contraseña', 'error');
        return;
      }

      showToast('¡Contraseña actualizada con éxito!', 'success');
      this.currentPasswordInput.value = '';
      this.newPasswordInput.value = '';
      this.confirmNewPasswordInput.value = '';

      navigationManager.showAuthenticatedApp();
    } catch {
      showToast('Error al conectar con el servidor', 'error');
    } finally {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = 'Actualizar contraseña y acceder';
    }
  }
}

export const changePasswordView = new ChangePasswordView();
