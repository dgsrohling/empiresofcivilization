/**
 * Gerador pseudoaleatório determinístico (mulberry32).
 * Toda aleatoriedade da simulação deve passar por aqui para que seeds sejam reproduzíveis
 * no navegador e no servidor.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Inteiro em [min, maxInclusive]. */
  int(min: number, maxInclusive: number): number {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: lista vazia');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }
}

/** Converte texto em seed. Números são usados diretamente; demais textos usam hash FNV-1a. */
export function seedFromString(text: string): number {
  const trimmed = text.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) >>> 0;
  let hash = 0x811c9dc5;
  for (let i = 0; i < trimmed.length; i++) {
    hash ^= trimmed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
