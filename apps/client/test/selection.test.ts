import { describe, expect, it } from 'vitest';
import { SelectionModel } from '../src/game/selection/SelectionModel';

describe('SelectionModel', () => {
  it('define, adiciona e alterna sem duplicar', () => {
    const s = new SelectionModel();
    s.set([1, 2, 2]);
    expect(s.current).toEqual([1, 2]);
    s.add([2, 3]);
    expect(s.current).toEqual([1, 2, 3]);
    s.toggle(2);
    expect(s.current).toEqual([1, 3]);
    s.toggle(4);
    expect(s.current).toEqual([1, 3, 4]);
  });

  it('grupos de controle guardam cópias independentes', () => {
    const s = new SelectionModel();
    const ids = [5, 6];
    s.assignGroup(1, ids);
    ids.push(7);
    expect(s.getGroup(1)).toEqual([5, 6]);
    s.assignGroup(1, []);
    expect(s.getGroup(1)).toEqual([]);
  });

  it('remove entidades inexistentes da seleção e dos grupos', () => {
    const s = new SelectionModel();
    s.set([1, 2, 3]);
    s.assignGroup(2, [2, 3]);
    s.prune((id) => id !== 2);
    expect(s.current).toEqual([1, 3]);
    expect(s.getGroup(2)).toEqual([3]);
  });

  it('incrementa a revisão a cada alteração', () => {
    const s = new SelectionModel();
    const r = s.revision;
    s.set([1]);
    expect(s.revision).toBeGreaterThan(r);
  });
});
