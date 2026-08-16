/**
 * Background Service Worker - Mesa de Ayuda
 * Configuración de Chrome Side Panel API (Manifest V3)
 */

// Permite abrir automáticamente el panel lateral al hacer clic en el icono de acción de la extensión
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => {
    console.error('Error al configurar el comportamiento del Side Panel:', error);
  });

// Listener de ciclo de vida de instalación
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extensión Mesa de Ayuda instalada y lista (Fase 1).');
});
