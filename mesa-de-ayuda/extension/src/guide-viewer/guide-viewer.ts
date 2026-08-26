import { fetchRemoteGuideById, RemoteGuide } from '../sidepanel/services/api-client';

class GuideViewerApp {
  private titleEl!: HTMLElement;
  private tagsContainer!: HTMLElement;
  private zoomIndicator!: HTMLElement;
  private canvasContainer!: HTMLElement;
  private transformWrapper!: HTMLElement;
  private mainImage!: HTMLImageElement;
  private loadingBox!: HTMLElement;
  private errorBox!: HTMLElement;
  private errorTitle!: HTMLElement;
  private errorDesc!: HTMLElement;
  private footerEl!: HTMLElement;
  private descEl!: HTMLElement;

  private currentGuide: RemoteGuide | null = null;
  private zoomLevel = 1.0; // 1.0 = 100%
  private minZoom = 0.1;
  private maxZoom = 5.0;

  // Estados de arrastre / pan
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private scrollLeft = 0;
  private scrollTop = 0;

  async init(): Promise<void> {
    this.titleEl = document.getElementById('viewer-guide-title') as HTMLElement;
    this.tagsContainer = document.getElementById('viewer-tags-container') as HTMLElement;
    this.zoomIndicator = document.getElementById('zoom-level-text') as HTMLElement;
    this.canvasContainer = document.getElementById('viewer-canvas-container') as HTMLElement;
    this.transformWrapper = document.getElementById('image-transform-wrapper') as HTMLElement;
    this.mainImage = document.getElementById('viewer-main-image') as HTMLImageElement;
    this.loadingBox = document.getElementById('viewer-loading') as HTMLElement;
    this.errorBox = document.getElementById('viewer-error') as HTMLElement;
    this.errorTitle = document.getElementById('viewer-error-title') as HTMLElement;
    this.errorDesc = document.getElementById('viewer-error-desc') as HTMLElement;
    this.footerEl = document.getElementById('viewer-footer') as HTMLElement;
    this.descEl = document.getElementById('viewer-guide-desc') as HTMLElement;

    this.setupEventListeners();
    await this.loadGuideFromParams();
  }

  private setupEventListeners(): void {
    // Botones de Zoom
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.applyZoom(this.zoomLevel + 0.25));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.applyZoom(this.zoomLevel - 0.25));
    document.getElementById('btn-actual-size')?.addEventListener('click', () => this.applyZoom(1.0));
    document.getElementById('btn-fit-screen')?.addEventListener('click', () => this.fitToScreen());

    // Descargar imagen
    document.getElementById('btn-download')?.addEventListener('click', () => this.downloadImage());

    // Zoom con rueda del ratón
    this.canvasContainer?.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        this.applyZoom(this.zoomLevel + delta);
      },
      { passive: false }
    );

    // Pan / Drag para mover el lienzo
    this.canvasContainer?.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.startX = e.pageX - this.canvasContainer.offsetLeft;
      this.startY = e.pageY - this.canvasContainer.offsetTop;
      this.scrollLeft = this.canvasContainer.scrollLeft;
      this.scrollTop = this.canvasContainer.scrollTop;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvasContainer?.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      const x = e.pageX - this.canvasContainer.offsetLeft;
      const y = e.pageY - this.canvasContainer.offsetTop;
      const walkX = (x - this.startX) * 1.2;
      const walkY = (y - this.startY) * 1.2;
      this.canvasContainer.scrollLeft = this.scrollLeft - walkX;
      this.canvasContainer.scrollTop = this.scrollTop - walkY;
    });

    // Doble clic para ajustar a pantalla
    this.mainImage?.addEventListener('dblclick', () => {
      this.fitToScreen();
    });
  }

  private async loadGuideFromParams(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const guideId = params.get('id');

    if (!guideId) {
      this.showError('Identificador de guía no proporcionado.', 'Abre una guía desde el panel de Mesa de Ayuda.');
      return;
    }

    try {
      const res = await fetchRemoteGuideById(guideId);
      if (!res.success || !res.data) {
        this.showError('No se pudo encontrar la guía solicitada.', res.error?.message || 'Verifica tu conexión o permisos.');
        return;
      }

      this.currentGuide = res.data;
      this.renderGuideData(res.data);
    } catch (err: any) {
      this.showError('Error al conectar con el servidor.', err.message || 'Error desconocido.');
    }
  }

  private renderGuideData(guide: RemoteGuide): void {
    // Título y Document Title
    this.titleEl.textContent = guide.title;
    document.title = `${guide.title} - Guía Visual | Mesa de Ayuda`;

    // Tags / Palabras clave
    this.tagsContainer.innerHTML = '';
    guide.keywords.forEach((kw) => {
      const chip = document.createElement('span');
      chip.className = 'viewer-tag-chip';
      chip.textContent = `#${kw}`;
      this.tagsContainer.appendChild(chip);
    });

    // Descripción
    if (guide.description && guide.description.trim()) {
      this.descEl.textContent = guide.description.trim();
      this.footerEl.classList.remove('hidden');
    }

    // Cargar imagen
    this.mainImage.onload = () => {
      this.loadingBox.classList.add('hidden');
      this.transformWrapper.classList.remove('hidden');
      this.fitToScreen();
    };

    this.mainImage.onerror = () => {
      this.showError('No se pudo cargar el archivo de imagen.', 'El enlace temporal expiró o el archivo no está disponible.');
    };

    this.mainImage.src = guide.imageUrl;
  }

  private applyZoom(newZoom: number): void {
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    this.transformWrapper.style.transform = `scale(${this.zoomLevel})`;
    this.zoomIndicator.textContent = `${Math.round(this.zoomLevel * 100)}%`;
  }

  private fitToScreen(): void {
    if (!this.mainImage.naturalWidth || !this.mainImage.naturalHeight) return;

    const padding = 40;
    const availableWidth = this.canvasContainer.clientWidth - padding;
    const availableHeight = this.canvasContainer.clientHeight - padding;

    const scaleX = availableWidth / this.mainImage.naturalWidth;
    const scaleY = availableHeight / this.mainImage.naturalHeight;

    const fitScale = Math.min(scaleX, scaleY, 1.0);
    this.applyZoom(fitScale);

    // Centrar scroll
    this.canvasContainer.scrollLeft = (this.canvasContainer.scrollWidth - this.canvasContainer.clientWidth) / 2;
    this.canvasContainer.scrollTop = (this.canvasContainer.scrollHeight - this.canvasContainer.clientHeight) / 2;
  }

  private downloadImage(): void {
    if (!this.mainImage.src || !this.currentGuide) return;
    const a = document.createElement('a');
    a.href = this.mainImage.src;
    a.download = `${this.currentGuide.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  private showError(title: string, desc: string): void {
    this.loadingBox.classList.add('hidden');
    this.transformWrapper.classList.add('hidden');
    this.errorTitle.textContent = title;
    this.errorDesc.textContent = desc;
    this.errorBox.classList.remove('hidden');
  }
}

const app = new GuideViewerApp();
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
