import type { EntityId } from '@eoc/shared';

/**
 * Seleção atual e grupos de controle (Ctrl + número). Estado puramente de interface:
 * a simulação não conhece seleção, apenas os comandos resultantes.
 */
export class SelectionModel {
  private ids: EntityId[] = [];
  private readonly groups = new Map<number, EntityId[]>();
  private version = 0;

  get current(): readonly EntityId[] {
    return this.ids;
  }

  /** Muda sempre que a seleção é alterada (útil para evitar recomputações). */
  get revision(): number {
    return this.version;
  }

  has(id: EntityId): boolean {
    return this.ids.includes(id);
  }

  set(ids: readonly EntityId[]): void {
    this.ids = [...new Set(ids)];
    this.version++;
  }

  add(ids: readonly EntityId[]): void {
    this.set([...this.ids, ...ids]);
  }

  toggle(id: EntityId): void {
    this.set(this.has(id) ? this.ids.filter((x) => x !== id) : [...this.ids, id]);
  }

  clear(): void {
    if (this.ids.length === 0) return;
    this.set([]);
  }

  assignGroup(slot: number, ids: readonly EntityId[]): void {
    if (ids.length === 0) this.groups.delete(slot);
    else this.groups.set(slot, [...ids]);
  }

  getGroup(slot: number): readonly EntityId[] {
    return this.groups.get(slot) ?? [];
  }

  /** Remove ids que deixaram de existir (seleção e grupos). */
  prune(exists: (id: EntityId) => boolean): void {
    if (this.ids.some((id) => !exists(id))) this.set(this.ids.filter(exists));
    for (const [slot, ids] of this.groups) {
      const alive = ids.filter(exists);
      if (alive.length === 0) this.groups.delete(slot);
      else if (alive.length !== ids.length) this.groups.set(slot, alive);
    }
  }
}
