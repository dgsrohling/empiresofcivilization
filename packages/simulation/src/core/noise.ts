export type Noise2D = (x: number, y: number) => number;

function hash2(seed: number, x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Value noise 2D com interpolação suave, determinístico pela seed. Retorna valores em [0, 1). */
export function createValueNoise(seed: number): Noise2D {
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash2(seed, x0, y0);
    const b = hash2(seed, x0 + 1, y0);
    const c = hash2(seed, x0, y0 + 1);
    const d = hash2(seed, x0 + 1, y0 + 1);
    const top = a + (b - a) * sx;
    const bottom = c + (d - c) * sx;
    return top + (bottom - top) * sy;
  };
}

/** Fractal Brownian motion: soma de oitavas de ruído. */
export function fbm(noise: Noise2D, x: number, y: number, octaves = 4): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency + i * 17.31, y * frequency + i * 31.73) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}

/** Reescala os valores do array para o intervalo [0, 1]. */
export function normalizeInPlace(values: Float32Array): void {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  for (let i = 0; i < values.length; i++) values[i] = ((values[i] as number) - min) / span;
}
