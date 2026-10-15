import { RESOURCE_NODE_DEFINITIONS, getTerrain } from '@eoc/game-data';
import { useEffect, useRef } from 'react';
import type { GameSession } from '../game/GameSession';
import { TILE_H, TILE_W } from '../game/iso';
import { toCssColor } from '../game/rendering/color';

const WIDTH = 256;
const HEIGHT = 128;
const REFRESH_MS = 100;
const RESOURCE_COLORS: Record<keyof typeof RESOURCE_NODE_DEFINITIONS, string> = {
  tree: '#24451b',
  goldMine: '#f2c94c',
  stoneMine: '#c9c3b6',
  berryBush: '#c0506a',
};

/**
 * Minimapa em losango (mesma projeção isométrica do mapa). Desenha direto no canvas
 * a partir do estado da simulação, sem passar pelo React a cada atualização.
 */
export function Minimap({ session }: { session: GameSession }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const world = session.sim.world;
    const { width: W, height: H } = world;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;

    // Imagem base: 1 pixel por tile (terreno + recursos estáticos). Refeita quando recursos se esgotam.
    const base = document.createElement('canvas');
    base.width = W;
    base.height = H;
    const bctx = base.getContext('2d')!;
    const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    let baseRevision = -1;
    const buildBase = () => {
      const img = bctx.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        const [r, g, b] = rgb(getTerrain(world.map.terrain[i]!).color);
        img.data.set([r!, g!, b!, 255], i * 4);
      }
      for (const res of world.resources) {
        const [r, g, b] = rgb(RESOURCE_COLORS[res.nodeType]);
        img.data.set([r!, g!, b!, 255], (res.tileY * W + res.tileX) * 4);
      }
      bctx.putImageData(img, 0, 0);
      baseRevision = world.staticRevision;
    };

    const kx = WIDTH / (W + H);
    const ky = HEIGHT / (W + H);
    const toMini = (x: number, y: number): [number, number] => [(x - y + H) * kx, (x + y) * ky];

    const draw = () => {
      if (baseRevision !== world.staticRevision) buildBase();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(kx * dpr, ky * dpr, -kx * dpr, ky * dpr, H * kx * dpr, 0);
      ctx.drawImage(base, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (const b of world.buildings) {
        const color = toCssColor(world.getPlayer(b.owner)?.color ?? 0xffffff);
        const [mx, my] = toMini(b.x, b.y);
        ctx.fillStyle = '#000';
        ctx.fillRect(mx - 4, my - 3, 8, 6);
        ctx.fillStyle = color;
        ctx.fillRect(mx - 3, my - 2, 6, 4);
      }
      for (const u of world.units) {
        const [mx, my] = toMini(u.x, u.y);
        ctx.fillStyle = toCssColor(world.getPlayer(u.owner)?.color ?? 0xffffff);
        ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      }
      // Alertas de ataque: círculos vermelhos pulsando por alguns segundos.
      const now = world.time;
      for (const ping of session.pings) {
        const age = now - ping.time;
        if (age > 4 || age < 0) continue;
        const [mx, my] = toMini(ping.x, ping.y);
        ctx.strokeStyle = `rgba(255,70,50,${1 - age / 4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mx, my, 4 + (age % 1) * 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      const view = session.getViewRect();
      if (view) {
        const x = (view.x / (TILE_W / 2) + H) * kx;
        const y = (view.y / (TILE_H / 2)) * ky;
        const w = (view.width / (TILE_W / 2)) * kx;
        const h = (view.height / (TILE_H / 2)) * ky;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
      }
    };
    draw();
    const timer = window.setInterval(draw, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [session]);

  const moveCamera = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const world = session.sim.world;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const my = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    const kx = WIDTH / (world.width + world.height);
    const ky = HEIGHT / (world.width + world.height);
    session.centerOnScreenPoint((mx / kx - world.height) * (TILE_W / 2), (my / ky) * (TILE_H / 2));
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: WIDTH, height: HEIGHT }}
      className="cursor-crosshair"
      data-testid="minimap"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        moveCamera(e);
      }}
      onPointerMove={(e) => e.buttons === 1 && moveCamera(e)}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
