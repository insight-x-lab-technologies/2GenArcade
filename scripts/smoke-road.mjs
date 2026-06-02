import puppeteer from 'puppeteer-core';

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:8123/';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

const errors = [];
const log = (...a) => console.log('[road]', ...a);
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
    () => [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') || '').includes('Road Burner')),
    { timeout: 10000 },
  );
  log('home grid visible');

  const nickInput = await page.$('input');
  if (nickInput) {
    await nickInput.type('RDB');
    const saveBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find((b) => /salvar|save/i.test(b.textContent || '')),
    );
    if (saveBtn) await saveBtn.asElement()?.click();
    log('nickname set');
  }

  await page.evaluate(() => {
    const card = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').includes('Road Burner'));
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
  await sleep(700);
  log('canvas mounted');

  // Drive a moment: weave right, then accelerate.
  await page.keyboard.down('ArrowRight');
  await sleep(450);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowUp'); // accelerate
  await sleep(500);

  const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return false;
    const g = c.getContext('2d');
    if (!g) return false;
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let nonbg = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - 8) + Math.abs(data[i + 1] - 5) + Math.abs(data[i + 2] - 20) > 60) nonbg += 1;
    }
    return nonbg > 400;
  });
  log('canvas painted:', painted);
  if (!painted) errors.push('canvas appears blank');

  await page.screenshot({ path: 'scripts/smoke-road.png' });
  log('screenshot saved');

  // Hug the left guardrail (still accelerating) so lane-0 traffic crashes us.
  await page.keyboard.down('ArrowLeft');
  const overReached = await page
    .waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('fim de jogo') || t.includes('game over');
    }, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowUp');
  log('game over reached:', overReached);
  if (!overReached) errors.push('did not reach game-over screen');

  if (errors.length) {
    console.error('[road] CONSOLE/PAGE ERRORS:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    log('PASS — Road Burner plays and reaches game over, no console errors');
  }
} catch (e) {
  console.error('[road] FAILED:', e.message);
  if (errors.length) console.error('[road] console errors:\n' + errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
