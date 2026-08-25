import { StructuredApiError, ApiErrorSource } from '../services/api-client';

export type ToastType = 'success' | 'error' | 'info';

const SOURCE_LABELS: Record<ApiErrorSource, string> = {
  frontend: 'Frontend / Extensión',
  validation: 'Validación de datos',
  auth: 'Autenticación / Permisos',
  backend: 'Servidor Backend',
  database: 'Base de datos (PostgreSQL)',
  groq: 'Proveedor de IA (Groq)',
  'rate-limit': 'Límite de solicitudes',
  network: 'Conectividad / Red',
  unknown: 'Desconocido',
};

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

export function showDiagnosticError(error?: StructuredApiError | string | Error, duration = 4500): void {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-message toast-error toast-diagnostic';

  if (!error) {
    toast.textContent = 'Ocurrió un error inesperado al procesar la solicitud.';
  } else if (typeof error === 'string') {
    toast.textContent = error;
  } else if (error instanceof Error) {
    toast.textContent = error.message;
  } else {
    // Es un StructuredApiError
    const isDev = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.DEV || (import.meta as any).env?.MODE === 'development');
    const sourceLabel = SOURCE_LABELS[error.source] || error.source || 'Desconocido';

    const header = document.createElement('div');
    header.className = 'toast-diag-header';
    header.textContent = `⚠️ ${error.message || 'No se pudo procesar la solicitud'}`;
    toast.appendChild(header);

    const details = document.createElement('div');
    details.className = 'toast-diag-details';

    const pSource = document.createElement('div');
    pSource.textContent = `Origen: ${sourceLabel} | Código: ${error.code}`;
    details.appendChild(pSource);

    if (isDev && (error.status || error.endpoint)) {
      const pDev = document.createElement('div');
      pDev.className = 'toast-diag-dev';
      pDev.textContent = `HTTP ${error.status || 'N/A'} • ${error.endpoint || ''}`;
      details.appendChild(pDev);
    }

    if (error.requestId) {
      const pReq = document.createElement('div');
      pReq.className = 'toast-diag-req';
      pReq.textContent = `Request ID: ${error.requestId}`;
      details.appendChild(pReq);
    }

    toast.appendChild(details);
  }

  toastContainer.appendChild(toast);

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
