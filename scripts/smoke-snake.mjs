import puppeteer from 'puppeteer-core';

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:8123/';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

const errors = [];
const log = (...a) => console.log('[snake]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  log('loaded', await page.title());

  await page.waitForFunction(() => {
    const t = document.body.innerText.toLowerCase();
    return t.includes('ficha') || t.includes('coin');
  }, { timeout: 10000 });
  await page.click('body');

  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') || '').includes('Snake Coil')),
    { timeout: 10000 },
  );
  log('home grid visible');

  const nickInput = await page.$('input');
  if (nickInput) {
    await nickInput.type('SNK');
    const saveBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find((b) => /salvar|save/i.test(b.textContent || '')),
    );
    if (saveBtn) await saveBtn.asElement()?.click();
    log('nickname set');
  }

  await page.evaluate(() => {
    const card = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').includes('Snake Coil'));
    card?.click();
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => /jogar|play/i.test(b.textContent || '')),
    { timeout: 10000 },
  );
  log('detail visible');

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /jogar|play/i.test(b.textContent || ''));
    btn?.click();
  });

  await page.waitForSelector('canvas', { timeout: 10000 });
  await sleep(600);
  log('canvas mounted');

  // Steer the Coil around a loop so it survives and eats; arrows map to d-pad.
  const moves = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  for (let i = 0; i < 16; i += 1) {
    await page.keyboard.press(moves[i % moves.length]);
    await sleep(220);
  }

  const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return false;
    const g = c.getContext('2d');
    if (!g) return false;
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let nonbg = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - 13) + Math.abs(data[i + 1] - 8) + Math.abs(data[i + 2] - 32) > 60) nonbg += 1;
    }
    return nonbg > 200;
  });
  log('canvas painted:', painted);
  if (!painted) errors.push('canvas appears blank (no rendered Coil/orb)');

  await page.screenshot({ path: 'scripts/smoke-snake.png' });
  log('screenshot saved');

  // Now run straight up into the wall to confirm the game-over flow.
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('ArrowUp');
    await sleep(60);
  }
  const overReached = await page
    .waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('fim de jogo') || t.includes('game over');
    }, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  log('game over reached:', overReached);
  if (!overReached) errors.push('did not reach game-over screen');

  if (errors.length) {
    console.error('[snake] CONSOLE/PAGE ERRORS:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    log('PASS — Snake Coil plays and reaches game over, no console errors');
  }
} catch (e) {
  console.error('[snake] FAILED:', e.message);
  if (errors.length) console.error('[snake] console errors:\n' + errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
