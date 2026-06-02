import puppeteer from 'puppeteer-core';

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:8123/';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

const errors = [];
const log = (...a) => console.log('[smoke]', ...a);

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

  // Splash → tap to enter.
  await page.waitForFunction(() => {
    const t = document.body.innerText.toLowerCase();
    return t.includes('ficha') || t.includes('coin');
  }, { timeout: 10000 });
  log('splash visible');
  await page.click('body');

  // Home → wait for a game card labelled Block Drop.
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') || '').includes('Block Drop')),
    { timeout: 10000 },
  );
  log('home grid visible');

  // If a nickname modal is up, fill and save.
  const nickInput = await page.$('input');
  if (nickInput) {
    await nickInput.type('TEST');
    const saveBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find((b) => /salvar|save/i.test(b.textContent || '')),
    );
    if (saveBtn) await saveBtn.asElement()?.click();
    log('nickname set');
  }

  // Open Block Drop detail.
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').includes('Block Drop'));
    card?.click();
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => /jogar|play/i.test(b.textContent || '')),
    { timeout: 10000 },
  );
  log('detail visible');

  // Press Play.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /jogar|play/i.test(b.textContent || ''));
    btn?.click();
  });

  // Gameplay → canvas should mount.
  await page.waitForSelector('canvas', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));
  log('canvas mounted');

  // Drive some input: rotate + move + hard drop a few times.
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await new Promise((r) => setTimeout(r, 120));
  }

  // Confirm the canvas actually painted (non-blank pixels).
  const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return false;
    const g = c.getContext('2d');
    if (!g) return false;
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let nonbg = 0;
    for (let i = 0; i < data.length; i += 4) {
      // background is ~ (13,8,32); count clearly different pixels
      if (Math.abs(data[i] - 13) + Math.abs(data[i + 1] - 8) + Math.abs(data[i + 2] - 32) > 60) nonbg += 1;
    }
    return nonbg > 200;
  });
  log('canvas painted blocks:', painted);

  await page.screenshot({ path: 'scripts/smoke-gameplay.png' });
  log('screenshot saved');

  if (!painted) errors.push('canvas appears blank (no rendered blocks)');

  if (errors.length) {
    console.error('[smoke] CONSOLE/PAGE ERRORS:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    log('PASS — no console errors, gameplay rendered');
  }
} catch (e) {
  console.error('[smoke] FAILED:', e.message);
  try {
    const pages = await browser.pages();
    const body = await pages[0]?.evaluate(() => document.body.innerText);
    console.error('[smoke] body text:', JSON.stringify(body));
  } catch {
    /* ignore */
  }
  if (errors.length) console.error('[smoke] console errors:\n' + errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
