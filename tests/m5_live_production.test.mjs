import assert from 'node:assert';
import puppeteer from 'puppeteer';

async function runLiveProductionSmoke() {
  console.log('================================================================');
  console.log('MILESTONE M5: NETLIFY LIVE PRODUCTION SMOKE VERIFICATION');
  console.log('Target URL: https://luminadesk-gary.netlify.app');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    // Test 1: Home Dashboard Viewport
    console.log('1. Navigating to live production root (https://luminadesk-gary.netlify.app)...');
    const response = await page.goto('https://luminadesk-gary.netlify.app', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    assert.strictEqual(response.status(), 200, 'HTTP status must be 200');
    console.log('   ✔ HTTP Status 200 OK');

    const title = await page.title();
    console.log('   Page Title:', title);
    assert.ok(title.includes('KUTZ // BARBER OS'), 'Title must contain KUTZ // BARBER OS');
    console.log('   ✔ Title matches KUTZ // BARBER OS specification');

    const bodyText = await page.evaluate(() => document.body.innerText);
    assert.ok(bodyText.includes('STUDIO OS'), 'Dashboard must contain STUDIO OS branding');
    assert.ok(bodyText.includes('SILLÓN') || bodyText.includes('SILLONES'), 'Dashboard must show Chair stations');
    assert.ok(bodyText.includes('COLA') || bodyText.includes('WALK-IN'), 'Dashboard must show Walk-in queue');
    console.log('   ✔ Dashboard live UI components mounted successfully');

    // Test 2: Clients Page & 3D Flip Card
    console.log('2. Navigating to live /clients (SPA route test)...');
    const clientsResponse = await page.goto('https://luminadesk-gary.netlify.app/clients', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    assert.strictEqual(clientsResponse.status(), 200, 'SPA route must return HTTP 200');

    await page.waitForSelector('article, .perspective-1000', { timeout: 10000 });
    const clientsBody = await page.evaluate(() => document.body.innerText.toLowerCase());
    assert.ok(clientsBody.includes('alex rivera') || clientsBody.includes('álex rivera'), 'Clients page must display client cards');
    console.log('   ✔ SPA client routing and Bento Grid mounted with Álex Rivera card');

    // Test 3: Flip interaction in production
    console.log('3. Testing 3D Flip Card interaction on live site...');
    const flipBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const flip = btns.find(b => b.innerText.includes('VOLTEAR') || b.innerText.includes('FICHA') || b.title?.includes('Voltear'));
      if (flip) {
        flip.click();
        return true;
      }
      return false;
    });
    assert.ok(flipBtn, 'Flip button must exist and be clickable');
    await new Promise(r => setTimeout(r, 600));

    const postFlipBody = await page.evaluate(() => document.body.innerText);
    const hasFormulaNotes = postFlipBody.includes('FÓRMULA') || postFlipBody.includes('GUARDAS') || postFlipBody.includes('FADE') || postFlipBody.includes('RITUAL');
    assert.ok(hasFormulaNotes, 'Back of 3D card must reveal formula or technical notes');
    console.log('   ✔ 3D Flip Card turned 180° revealing technical formula on live production');

    // Test 4: Console Error Check
    console.log('4. Checking console error log...');
    // Ignore any harmless third party font warnings if any
    const realErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('font'));
    assert.strictEqual(realErrors.length, 0, `Expected 0 runtime console errors, got: ${JSON.stringify(realErrors)}`);
    console.log('   ✔ 0 runtime console errors detected on live production');

    console.log('\n================================================================');
    console.log('LIVE PRODUCTION DEPLOYMENT VERIFICATION: 100% SUCCESS');
    console.log('================================================================');
  } finally {
    await browser.close();
  }
}

runLiveProductionSmoke().catch(err => {
  console.error('Smoke verification failed:', err);
  process.exit(1);
});
