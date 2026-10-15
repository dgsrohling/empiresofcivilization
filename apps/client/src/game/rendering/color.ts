export function hexToRgb(color: string | number): [number, number, number] {
  const n = typeof color === 'number' ? color : parseInt(color.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Clareia (amount > 0) ou escurece (amount < 0) uma cor. amount em [-1, 1]. */
export function shade(color: string | number, amount: number, alpha = 1): string {
  const [r, g, b] = hexToRgb(color);
  const f = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `rgba(${f(r)},${f(g)},${f(b)},${alpha})`;
}

export function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
