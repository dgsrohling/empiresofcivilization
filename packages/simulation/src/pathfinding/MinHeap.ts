/**
 * Heap binária mínima de pares (prioridade, valor) com arrays reaproveitáveis.
 * Usada pelo A* com "lazy deletion": entradas obsoletas são ignoradas ao sair.
 */
export class MinHeap {
  private keys: number[] = [];
  private values: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  clear(): void {
    this.keys.length = 0;
    this.values.length = 0;
  }

  push(key: number, value: number): void {
    const keys = this.keys;
    const values = this.values;
    let i = keys.length;
    keys.push(key);
    values.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((keys[parent] as number) <= key) break;
      keys[i] = keys[parent] as number;
      values[i] = values[parent] as number;
      i = parent;
    }
    keys[i] = key;
    values[i] = value;
  }

  /** Remove e retorna o valor de menor prioridade. Assume heap não vazia. */
  pop(): number {
    const keys = this.keys;
    const values = this.values;
    const top = values[0] as number;
    const lastKey = keys.pop() as number;
    const lastValue = values.pop() as number;
    const n = keys.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        if (left >= n) break;
        const right = left + 1;
        const child = right < n && (keys[right] as number) < (keys[left] as number) ? right : left;
        if ((keys[child] as number) >= lastKey) break;
        keys[i] = keys[child] as number;
        values[i] = values[child] as number;
        i = child;
      }
      keys[i] = lastKey;
      values[i] = lastValue;
    }
    return top;
  }
}
