/**
 * Content Script - Mesa de Ayuda
 * Integración segura con páginas web para captura y reemplazo de texto seleccionado
 */

import { initContentMessaging } from './messaging';
import { captureSelection } from './selection';

// 1. Inicializar canal de mensajería con la extensión
initContentMessaging();

// 2. Actualizar estado de selección de forma pasiva y eficiente sin sobrecargar la página
document.addEventListener('mouseup', () => {
  captureSelection();
}, { passive: true });

document.addEventListener('keyup', (e) => {
  // Teclas de navegación / selección con teclado
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift', 'KeyA'].includes(e.code) || e.shiftKey) {
    captureSelection();
  }
}, { passive: true });
