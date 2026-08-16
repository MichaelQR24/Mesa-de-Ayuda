export type ToastType = 'success' | 'error' | 'info';

export function showToast(message: string, type: ToastType = 'success', duration = 2400): void {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Animación de entrada
  requestAnimationFrame(() => {
    toast.classList.add('toast-show');
  });

  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, duration);
}
