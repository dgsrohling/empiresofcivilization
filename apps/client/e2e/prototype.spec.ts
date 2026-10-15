import { expect, test, type Page } from '@playwright/test';

/** Erros de página/console fazem o teste falhar. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function startMatch(page: Page, seed = '12345') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Jogar' }).click();
  await page.getByRole('button', { name: /Pequeno/ }).click();
  await page.getByLabel('Semente do mapa').fill(seed);
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  await expect(page.getByTestId('top-bar')).toBeVisible();
  await page.waitForFunction(() => !!window.__EOC__?.getViewRect());
  // Aguarda alguns quadros para a câmera estabilizar.
  await page.waitForTimeout(300);
}

test('seleciona um aldeão e o move pelo mapa sem atravessar obstáculos', async ({ page }) => {
  const errors = collectErrors(page);
  await startMatch(page);
  await page.screenshot({ path: test.info().outputPath('01-inicio.png') });

  const unit = await page.evaluate(() => {
    const s = window.__EOC__!;
    const u = s.sim.world.units.find((x) => x.owner === 1 && x.type === 'villager')!;
    return { id: u.id, pos: s.worldToClient(u.x, u.y)! };
  });
  await page.mouse.click(unit.pos.x, unit.pos.y - 14);
  await expect(page.getByTestId('selection-name')).toHaveText('Aldeão');

  // Destino: tile livre, visível na tela (fora do HUD), a 6–10 tiles da unidade.
  const target = await page.evaluate((id) => {
    const s = window.__EOC__!;
    const world = s.sim.world;
    const u = world.getEntity(id)!;
    const viewportH = window.innerHeight;
    for (let r = 10; r >= 6; r--) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const tx = Math.floor(u.x + Math.cos(ang) * r);
        const ty = Math.floor(u.y + Math.sin(ang) * r);
        if (!world.grid.isWalkable(tx, ty) || world.grid.componentAt(tx, ty) !== world.grid.componentAt(Math.floor(u.x), Math.floor(u.y))) continue;
        const c = s.worldToClient(tx + 0.5, ty + 0.5)!;
        if (c.x > 40 && c.x < window.innerWidth - 40 && c.y > 70 && c.y < viewportH - 190) return { tx, ty, client: c };
      }
    }
    return null;
  }, unit.id);
  expect(target).not.toBeNull();
  await page.mouse.click(target!.client.x, target!.client.y, { button: 'right' });
  await expect(page.getByTestId('selection-status')).toHaveText('Em movimento');
  await page.waitForTimeout(400);
  await page.screenshot({ path: test.info().outputPath('02-movendo.png') });

  // Amostra a posição enquanto anda: nunca sobre tile intransitável.
  const result = await page.evaluate(
    ({ id }) =>
      new Promise<{ arrived: boolean; invalidSamples: number; x: number; y: number }>((resolve) => {
        const s = window.__EOC__!;
        let invalid = 0;
        const started = performance.now();
        const timer = setInterval(() => {
          const u = s.sim.world.getEntity(id)!;
          if (!s.sim.world.grid.isWalkableAt(u.x, u.y)) invalid++;
          if ((u.kind === 'unit' && u.state === 'idle') || performance.now() - started > 20000) {
            clearInterval(timer);
            resolve({ arrived: u.kind === 'unit' && u.state === 'idle', invalidSamples: invalid, x: u.x, y: u.y });
          }
        }, 50);
      }),
    { id: unit.id },
  );
  expect(result.arrived).toBe(true);
  expect(result.invalidSamples).toBe(0);
  expect(Math.hypot(result.x - (target!.tx + 0.5), result.y - (target!.ty + 0.5))).toBeLessThan(0.6);
  await expect(page.getByTestId('selection-status')).toHaveText('Ocioso');
  await page.screenshot({ path: test.info().outputPath('03-chegou.png') });
  expect(errors).toEqual([]);
});

test('seleção por arrasto, grupo de controle, menu e reinício sem recarregar a página', async ({ page }) => {
  const errors = collectErrors(page);
  await startMatch(page, '777');

  // Retângulo cobrindo todas as unidades do jogador.
  const box = await page.evaluate(() => {
    const s = window.__EOC__!;
    const pts = s.sim.world.units.filter((u) => u.owner === 1).map((u) => s.worldToClient(u.x, u.y)!);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { x0: Math.min(...xs) - 30, y0: Math.min(...ys) - 40, x1: Math.max(...xs) + 30, y1: Math.max(...ys) + 20 };
  });
  await page.mouse.move(box.x0, box.y0);
  await page.mouse.down();
  await page.mouse.move((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, { steps: 4 });
  await page.mouse.move(box.x1, box.y1, { steps: 4 });
  await page.screenshot({ path: test.info().outputPath('04-arrasto.png') });
  await page.mouse.up();
  await expect(page.getByTestId('selection-panel')).toContainText('6 unidades selecionadas');

  await page.keyboard.press('Control+Digit1');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('selection-panel')).toContainText('Nenhuma seleção');
  await page.keyboard.press('Digit1');
  await expect(page.getByTestId('selection-panel')).toContainText('6 unidades selecionadas');

  // Menu pausa o tempo de jogo.
  await page.keyboard.press('F10');
  await expect(page.getByRole('dialog', { name: 'Menu da partida' })).toBeVisible();
  const t0 = await page.evaluate(() => window.__EOC__!.sim.world.tick);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__EOC__!.sim.world.tick)).toBe(t0);

  // Reinício cria uma nova sessão sem recarregar a página.
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));
  await page.getByRole('button', { name: 'Nova partida (novo mapa)' }).click();
  await page.waitForFunction(() => !!window.__EOC__?.getViewRect() && window.__EOC__.sim.world.tick < 40);
  expect(await page.evaluate(() => (window as unknown as { __marker: number }).__marker)).toBe(42);
  expect(await page.evaluate(() => document.querySelectorAll('canvas[width]').length)).toBeGreaterThan(0);
  await expect(page.getByTestId('selection-panel')).toContainText('Nenhuma seleção');

  await page.keyboard.press('F10');
  await page.getByRole('button', { name: 'Sair da partida' }).click();
  await expect(page.getByRole('button', { name: 'Jogar' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('aldeão coleta comida pelo clique direito e o total na barra superior aumenta', async ({ page }) => {
  const errors = collectErrors(page);
  await startMatch(page, '4242');

  const villager = await page.evaluate(() => {
    const s = window.__EOC__!;
    s.timeScale = 8; // acelera o teste: 8× a velocidade normal
    const u = s.sim.world.units.find((x) => x.owner === 1 && x.type === 'villager')!;
    return { id: u.id, pos: s.worldToClient(u.x, u.y)! };
  });
  await page.mouse.click(villager.pos.x, villager.pos.y - 14);
  await expect(page.getByTestId('selection-name')).toHaveText('Aldeão');

  // Centraliza a câmera no arbusto mais próximo e clica com o botão direito nele.
  const bushId = await page.evaluate((id) => {
    const s = window.__EOC__!;
    const u = s.sim.world.getEntity(id)!;
    const bush = s.sim.world.resources.filter((r) => r.nodeType === 'berryBush').sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0]!;
    s.centerOnScreenPoint((bush.x - bush.y) * 32, (bush.x + bush.y) * 16);
    return bush.id;
  }, villager.id);
  await page.waitForTimeout(150);
  const bushPos = await page.evaluate((id) => {
    const s = window.__EOC__!;
    const b = s.sim.world.getEntity(id)!;
    return s.worldToClient(b.x, b.y)!;
  }, bushId);
  await page.mouse.click(bushPos.x, bushPos.y - 8, { button: 'right' });
  await expect(page.getByTestId('selection-status')).toHaveText(/comida/);

  const food = () => page.getByTestId('resource-food-amount').innerText().then(Number);
  await expect.poll(food, { timeout: 30_000 }).toBeGreaterThan(200);
  await page.screenshot({ path: test.info().outputPath('05-coleta.png') });

  const state = await page.evaluate(() => {
    const p = window.__EOC__!.sim.world.getPlayer(1)!;
    return { food: p.resources.food, gathered: p.stats.gathered.food };
  });
  expect(state.food).toBe(200 + state.gathered);
  expect(state.gathered % 10).toBe(0);

  await page.getByRole('button', { name: 'Economia' }).click();
  await expect(page.getByTestId('economy-panel')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('06-economia.png') });
  expect(errors).toEqual([]);
});

test('aldeão constrói uma casa pelo menu de construção e a população máxima aumenta', async ({ page }) => {
  const errors = collectErrors(page);
  await startMatch(page, '31337');

  const villager = await page.evaluate(() => {
    const s = window.__EOC__!;
    const u = s.sim.world.units.find((x) => x.owner === 1 && x.type === 'villager')!;
    return { id: u.id, pos: s.worldToClient(u.x, u.y)! };
  });
  await page.mouse.click(villager.pos.x, villager.pos.y - 14);
  await expect(page.getByTestId('selection-name')).toHaveText('Aldeão');

  await page.keyboard.press('b');
  await expect(page.getByTestId('build-menu')).toBeVisible();
  await page.keyboard.press('c');
  await expect(page.getByTestId('placement-hint')).toContainText('Casa');

  // Posição válida, visível e fora do HUD, perto do aldeão.
  const spot = await page.evaluate((id) => {
    const s = window.__EOC__!;
    const u = s.sim.world.getEntity(id)!;
    for (let r = 3; r < 10; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = Math.floor(u.x) + dx;
          const ty = Math.floor(u.y) + dy;
          if (!s.canPlace('house', tx, ty)) continue;
          const c = s.worldToClient(tx + 1, ty + 1)!;
          if (c.x > 80 && c.x < window.innerWidth - 80 && c.y > 120 && c.y < window.innerHeight - 220) return { tx, ty, c };
        }
      }
    }
    return null;
  }, villager.id);
  expect(spot).not.toBeNull();
  await page.mouse.move(spot!.c.x, spot!.c.y, { steps: 3 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: test.info().outputPath('07-posicionando.png') });
  await page.mouse.click(spot!.c.x, spot!.c.y);
  await expect(page.getByTestId('placement-hint')).toBeHidden();

  // O comando é aplicado no próximo tick da simulação (até 50 ms depois).
  await page.waitForFunction(() => window.__EOC__!.sim.world.buildings.some((b) => b.type === 'house' && b.owner === 1));
  const placed = await page.evaluate(() => {
    const w = window.__EOC__!.sim.world;
    const house = w.buildings.find((b) => b.type === 'house' && b.owner === 1);
    return house ? { id: house.id, x: house.tileX, y: house.tileY, complete: house.complete, wood: w.getPlayer(1)!.resources.wood } : null;
  });
  expect(placed).not.toBeNull();
  expect(placed!.complete).toBe(false);
  expect(placed!.wood).toBe(175);
  expect({ x: placed!.x, y: placed!.y }).toEqual({ x: spot!.tx, y: spot!.ty });
  await expect(page.getByTestId('selection-status')).toHaveText(/Casa/);

  await page.evaluate(() => (window.__EOC__!.timeScale = 3));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: test.info().outputPath('08-construindo.png') });
  await page.evaluate(() => (window.__EOC__!.timeScale = 10));
  await expect.poll(() => page.evaluate((id) => (window.__EOC__!.sim.world.getEntity(id) as { complete: boolean }).complete, placed!.id), { timeout: 30_000 }).toBe(true);
  await expect(page.getByTestId('top-bar')).toContainText('6/15');
  await page.screenshot({ path: test.info().outputPath('09-concluida.png') });
  expect(errors).toEqual([]);
});
