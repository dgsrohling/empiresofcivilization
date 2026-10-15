import Phaser from 'phaser';

export interface CameraSettings {
  edgeScroll: boolean;
  cameraSpeed: number;
}

const BASE_SPEED = 900;
const EDGE_SIZE = 10;
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2;

const KEY_DIRECTIONS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

/**
 * Câmera RTS independente das unidades: teclado (WASD/setas), bordas da tela,
 * arrastar com botão do meio e zoom na roda do mouse mantendo o ponto sob o cursor.
 */
export class CameraController {
  private readonly pressed = new Set<string>();
  private mouseX = -1;
  private mouseY = -1;
  private mouseInWindow = false;
  private dragging = false;
  private dragLastX = 0;
  private dragLastY = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getSettings: () => CameraSettings,
    /** Teclas que, no momento, pertencem a um comando de unidade (ex.: S = parar). */
    private readonly isReservedKey: (code: string) => boolean,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('mousemove', this.onMouseMove);
    document.documentElement.addEventListener('mouseleave', this.onMouseLeave);

    const input = scene.input;
    input.on('wheel', (pointer: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
      this.zoomAt(pointer.x, pointer.y, dy > 0 ? 1 / 1.15 : 1.15);
    });
    input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.dragging = true;
        this.dragLastX = pointer.x;
        this.dragLastY = pointer.y;
      }
    });
    input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const cam = this.camera;
      cam.scrollX -= (pointer.x - this.dragLastX) / cam.zoom;
      cam.scrollY -= (pointer.y - this.dragLastY) / cam.zoom;
      this.dragLastX = pointer.x;
      this.dragLastY = pointer.y;
    });
    input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.middleButtonDown()) this.dragging = false;
    });
  }

  private get camera(): Phaser.Cameras.Scene2D.Camera {
    return this.scene.cameras.main;
  }

  update(deltaMs: number): void {
    const settings = this.getSettings();
    let vx = 0;
    let vy = 0;
    for (const code of this.pressed) {
      const dir = KEY_DIRECTIONS[code];
      if (!dir || this.isReservedKey(code)) continue;
      vx += dir[0];
      vy += dir[1];
    }
    if (settings.edgeScroll && this.mouseInWindow && !this.dragging) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (this.mouseX <= EDGE_SIZE) vx -= 1;
      else if (this.mouseX >= w - EDGE_SIZE) vx += 1;
      if (this.mouseY <= EDGE_SIZE) vy -= 1;
      else if (this.mouseY >= h - EDGE_SIZE) vy += 1;
    }
    if (vx === 0 && vy === 0) return;
    const len = Math.hypot(vx, vy);
    const cam = this.camera;
    const step = (BASE_SPEED * settings.cameraSpeed * (deltaMs / 1000)) / cam.zoom;
    cam.scrollX += (vx / len) * step;
    cam.scrollY += (vy / len) * step;
  }

  /** Zoom mantendo fixo o ponto do mundo sob (screenX, screenY). */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    const cam = this.camera;
    const oldZoom = cam.zoom;
    const newZoom = Phaser.Math.Clamp(oldZoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (newZoom === oldZoom) return;
    // Phaser aplica o zoom em torno do centro da câmera.
    const halfW = cam.width / 2;
    const halfH = cam.height / 2;
    const worldX = cam.scrollX + halfW + (screenX - halfW) / oldZoom;
    const worldY = cam.scrollY + halfH + (screenY - halfH) / oldZoom;
    cam.setZoom(newZoom);
    cam.scrollX = worldX - halfW - (screenX - halfW) / newZoom;
    cam.scrollY = worldY - halfH - (screenY - halfH) / newZoom;
  }

  centerOn(screenX: number, screenY: number): void {
    this.camera.centerOn(screenX, screenY);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mousemove', this.onMouseMove);
    document.documentElement.removeEventListener('mouseleave', this.onMouseLeave);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isTypingTarget(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
    if (KEY_DIRECTIONS[e.code]) {
      this.pressed.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.pressed.clear();
    this.mouseInWindow = false;
    this.dragging = false;
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    this.mouseInWindow = true;
  };

  private readonly onMouseLeave = (): void => {
    this.mouseInWindow = false;
  };
}
