/**
 * Empirical Challenger M3 Stress Test Suite
 * Adversarial Testing of Dashboard Usability, Operations, and Ergonomics
 * 
 * Verifies:
 * 1. Chair State Cycling:
 *    - 100 rapid clicks on CH-01 (parity and state correctness)
 *    - Full period cycle (300 rapid clicks)
 *    - Multi-chair concurrent rapid clicks (CH-01, CH-02, CH-03)
 *    - Active chairs counter synchronization
 *    - Audio engine resilience under click bursts
 * 2. Queue Operations & Chair Seating:
 *    - Quick add walk-in form validation (empty name rejection, valid entry)
 *    - Adversarial input handling (long names, emojis, accents)
 *    - 1-tap "Sentar Siguiente" queue-to-chair workflow
 *    - Chair status mutation to CUTTING upon seating
 *    - Queue decrement and counter synchronization
 *    - Queue exhaustion boundary ("Cola Despejada", empty seating guard)
 *    - WhatsApp notification trigger
 * 3. Secondary Drawer Toggling & Layout Stability:
 *    - Rapid expand/collapse toggling (100 toggles parity test)
 *    - Multi-drawer simultaneous expansion
 *    - Viewport layout stability across 4 screen sizes (390px, 768px, 1280px, 1920px)
 *    - Zero horizontal overflow (scrollWidth <= clientWidth)
 * 4. Cognitive Glance & Above-the-Fold Ergonomics (<3s Scan):
 *    - Above-the-fold bounding rect measurements at 1280x800
 *    - Primary vs secondary information hierarchy audit
 *    - Collapsed-by-default initial state verification
 *    - Interaction & render latency benchmarking (<150ms per interaction)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

console.log('================================================================');
console.log('CHALLENGER M3: EMPIRICAL STRESS TEST SUITE');
console.log('Dashboard Usability & Operations Adversarial Verification');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

async function asyncTest(name, fn) {
  totalTests++;
  const start = performance.now();
  try {
    await fn();
    const duration = Math.round(performance.now() - start);
    passedTests++;
    console.log(`  ✔ [PASS] ${name} (${duration}ms)`);
    testResults.push({ name, status: 'PASS', duration });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    failedTests++;
    console.error(`  ✖ [FAIL] ${name} (${duration}ms)`);
    console.error(`    Error: ${err.message}`);
    testResults.push({ name, status: 'FAIL', duration, error: err.message });
  }
}

function startStaticServer() {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.webmanifest': 'application/manifest+json',
      '.ico': 'image/x-icon'
    };

    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || !reqPath.includes('.')) reqPath = '/index.html';
      const filePath = path.join(distDir, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(path.join(distDir, 'index.html')).pipe(res);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

// Helper to open a clean isolated page
async function createCleanPage(browser, url, width = 1280, height = 800) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  // Hook window.open and clean storage before navigation
  await page.evaluateOnNewDocument(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.__waCalls = [];
    window.open = (u, t, f) => {
      window.__waCalls.push({ url: u, target: t, features: f });
      return null;
    };
  });
  await page.goto(url, { waitUntil: 'networkidle0' });
  return page;
}

async function runAll() {
  assert.ok(fs.existsSync(distDir), 'Production dist/ directory must exist.');

  const { server, url } = await startStaticServer();
  console.log(`Test server active at: ${url}`);

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  try {
    // ========================================================================
    // SUITE 1: CHAIR STATE CYCLING ACROSS 100+ RAPID CLICKS
    // ========================================================================
    console.log('\n--- SUITE 1: Chair State Cycling Across 100+ Rapid Clicks ---');

    await asyncTest('Chair Cycling: Initial states and active counter start in expected baseline', async () => {
      const page = await createCleanPage(browser, url);

      const headerText = await page.$eval('main header', el => el.textContent);
      assert.ok(headerText.includes('2/3 SILLONES ACTIVOS'), `Expected 2/3 active chairs initially, got: ${headerText}`);

      const chairStatuses = await page.$$eval('section button[title*="rotar estado"]', btns => 
        btns.map(b => b.textContent.trim())
      );
      assert.strictEqual(chairStatuses.length, 3, 'Must have 3 chair buttons');
      assert.ok(chairStatuses[0].includes('EN CORTE // FADE'), `CH-01 should be CUTTING, got: ${chairStatuses[0]}`);
      assert.ok(chairStatuses[1].includes('WALK-IN LIBRE'), `CH-02 should be WALKIN, got: ${chairStatuses[1]}`);
      assert.ok(chairStatuses[2].includes('RITUAL BARBA & VAPOR'), `CH-03 should be BEARD, got: ${chairStatuses[2]}`);

      await page.close();
    });

    await asyncTest('Chair Cycling: 100 rapid clicks on CH-01 cycles state modulo 3 with parity preservation', async () => {
      const page = await createCleanPage(browser, url);

      const result = await page.evaluate(async () => {
        const btn = document.querySelectorAll('section button[title*="rotar estado"]')[0];
        const initialText = btn.textContent.trim();

        const startTime = performance.now();
        for (let i = 0; i < 100; i++) {
          btn.click();
        }
        await new Promise(r => setTimeout(r, 150));
        const duration = performance.now() - startTime;

        const finalText = btn.textContent.trim();
        const headerText = document.querySelector('main header').textContent;
        return { initialText, finalText, headerText, duration };
      });

      // Initial: statusIdx 0 (CUTTING). (0 + 100) % 3 = 1 -> WALKIN ("WALK-IN LIBRE")
      assert.ok(result.finalText.includes('WALK-IN LIBRE'), `Expected WALK-IN LIBRE after 100 clicks, got: ${result.finalText}`);
      
      // With CH-01 as WALKIN, CH-02 as WALKIN, CH-03 as BEARD -> active count is 1/3!
      assert.ok(result.headerText.includes('1/3 SILLONES ACTIVOS'), `Expected 1/3 active chairs after 100 clicks, got: ${result.headerText}`);

      console.log(`    [Metrics] 100 clicks dispatched and processed in ${Math.round(result.duration)}ms`);
      await page.close();
    });

    await asyncTest('Chair Cycling: 300 rapid clicks complete full 3-state period and return exactly to CUTTING', async () => {
      const page = await createCleanPage(browser, url);

      const result = await page.evaluate(async () => {
        const btn = document.querySelectorAll('section button[title*="rotar estado"]')[0];
        for (let i = 0; i < 300; i++) {
          btn.click();
        }
        await new Promise(r => setTimeout(r, 200));

        const finalText = btn.textContent.trim();
        const headerText = document.querySelector('main header').textContent;
        return { finalText, headerText };
      });

      // (0 + 300) % 3 = 0 -> CUTTING
      assert.ok(result.finalText.includes('EN CORTE // FADE'), `Expected EN CORTE // FADE after 300 clicks, got: ${result.finalText}`);
      assert.ok(result.headerText.includes('2/3 SILLONES ACTIVOS'), `Expected 2/3 active chairs after 300 clicks, got: ${result.headerText}`);

      await page.close();
    });

    await asyncTest('Chair Cycling: Concurrent interleaved clicks across all 3 chairs preserve state integrity', async () => {
      const page = await createCleanPage(browser, url);

      // Interleave clicks: CH-01 (50 clicks), CH-02 (50 clicks), CH-03 (50 clicks)
      const res = await page.evaluate(async () => {
        const btns = document.querySelectorAll('section button[title*="rotar estado"]');
        for (let i = 0; i < 50; i++) {
          btns[0].click();
          btns[1].click();
          btns[2].click();
        }
        await new Promise(r => setTimeout(r, 250));

        return {
          ch1: btns[0].textContent.trim(),
          ch2: btns[1].textContent.trim(),
          ch3: btns[2].textContent.trim(),
          header: document.querySelector('main header').textContent
        };
      });

      // Initial: CH-01 = 0, CH-02 = 1, CH-03 = 2
      // (0 + 50) % 3 = 2 -> BEARD
      // (1 + 50) % 3 = 0 -> CUTTING
      // (2 + 50) % 3 = 1 -> WALKIN
      assert.ok(res.ch1.includes('RITUAL BARBA & VAPOR'), `CH-01 expected BEARD, got: ${res.ch1}`);
      assert.ok(res.ch2.includes('EN CORTE // FADE'), `CH-02 expected CUTTING, got: ${res.ch2}`);
      assert.ok(res.ch3.includes('WALK-IN LIBRE'), `CH-03 expected WALKIN, got: ${res.ch3}`);

      // Active count: CH-01 (BEARD=active), CH-02 (CUTTING=active), CH-03 (WALKIN=not active) -> 2/3 active
      assert.ok(res.header.includes('2/3 SILLONES ACTIVOS'), `Expected 2/3 active, got: ${res.header}`);

      await page.close();
    });

    await asyncTest('Chair Cycling: Audio feedback invokes soundFx.playClick without throwing or leak', async () => {
      const page = await createCleanPage(browser, url);

      const errorCount = await page.evaluate(async () => {
        let errors = 0;
        window.addEventListener('error', () => errors++);
        const btn = document.querySelectorAll('section button[title*="rotar estado"]')[0];
        for (let i = 0; i < 50; i++) {
          btn.click();
        }
        await new Promise(r => setTimeout(r, 100));
        return errors;
      });

      assert.strictEqual(errorCount, 0, 'No audio or runtime errors should occur during rapid cycling');
      await page.close();
    });

    // ========================================================================
    // SUITE 2: QUEUE CHECK-IN AND SEATING FROM QUEUE INTO CHAIRS
    // ========================================================================
    console.log('\n--- SUITE 2: Queue Check-In and Seating from Queue into Chairs ---');

    await asyncTest('Queue Operations: Initial queue renders highlighted "SIGUIENTE TURNO" and counters', async () => {
      const page = await createCleanPage(browser, url);

      const queueCountText = await page.$eval('main header', el => {
        const span = Array.from(el.querySelectorAll('span')).find(s => s.textContent.includes('EN COLA VIVA'));
        return span ? span.textContent.trim() : '';
      });
      assert.ok(queueCountText.includes('2 EN COLA VIVA'), `Expected 2 in live queue initially, got: ${queueCountText}`);

      const nextTurnText = await page.$eval('section.lg\\:col-span-4', el => el.textContent);
      assert.ok(nextTurnText.includes('SIGUIENTE TURNO'), 'Zone B must highlight SIGUIENTE TURNO');
      assert.ok(nextTurnText.includes('Hugo Navarro'), 'First client in turn should be Hugo Navarro');

      await page.close();
    });

    await asyncTest('Queue Check-In: Add walk-in form validation blocks empty submissions', async () => {
      const page = await createCleanPage(browser, url);

      // Click "Añadir"
      const addBtn = await page.$('section.lg\\:col-span-4 button:has(svg)');
      await addBtn.click();
      await new Promise(r => setTimeout(r, 100));

      // Try submitting with empty name
      const queueCountBefore = await page.evaluate(() => {
        return document.querySelectorAll('section.lg\\:col-span-4 .font-serif.font-bold').length;
      });

      await page.evaluate(() => {
        const form = document.querySelector('section.lg\\:col-span-4 form');
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.click();
      });
      await new Promise(r => setTimeout(r, 100));

      const queueCountAfter = await page.evaluate(() => {
        return document.querySelectorAll('section.lg\\:col-span-4 .font-serif.font-bold').length;
      });

      assert.strictEqual(queueCountAfter, queueCountBefore, 'Empty submission must not increase queue count');
      await page.close();
    });

    await asyncTest('Queue Check-In: Valid walk-in submission adds client, updates counters, and resets form', async () => {
      const page = await createCleanPage(browser, url);

      // Open form
      await page.evaluate(() => {
        const addBtn = Array.from(document.querySelectorAll('section.lg\\:col-span-4 button'))
          .find(b => b.textContent.includes('Añadir'));
        addBtn.click();
      });
      await new Promise(r => setTimeout(r, 100));

      // Type details and submit
      await page.type('input[placeholder="Nombre del cliente..."]', 'Marco Torres');
      await page.type('input[placeholder="Teléfono (WhatsApp)..."]', '+34 699 887 766');

      await page.evaluate(() => {
        const form = document.querySelector('section.lg\\:col-span-4 form');
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.click();
      });
      await new Promise(r => setTimeout(r, 200));

      // Verify header counter updated to 3
      const headerText = await page.$eval('main header', el => el.textContent);
      assert.ok(headerText.includes('3 EN COLA VIVA'), `Queue header should be 3 EN COLA VIVA, got: ${headerText}`);

      // Verify Marco Torres is in the queue list
      const zoneBText = await page.$eval('section.lg\\:col-span-4', el => el.textContent);
      assert.ok(zoneBText.includes('Marco Torres'), 'Marco Torres must appear in queue');

      // Form should have closed
      const isFormOpen = await page.evaluate(() => {
        return !!document.querySelector('section.lg\\:col-span-4 form');
      });
      assert.strictEqual(isFormOpen, false, 'Add walk-in form should close after submission');

      await page.close();
    });

    await asyncTest('Queue Check-In: Adversarial inputs (emojis, unicode, long text) render cleanly without XSS', async () => {
      const page = await createCleanPage(browser, url);

      // Open form
      await page.evaluate(() => {
        const addBtn = Array.from(document.querySelectorAll('section.lg\\:col-span-4 button'))
          .find(b => b.textContent.includes('Añadir'));
        addBtn.click();
      });
      await new Promise(r => setTimeout(r, 100));

      const complexName = '💈 Álvaro José "El Rayo" Peña <script>alert("xss")</script> 🔥';
      await page.type('input[placeholder="Nombre del cliente..."]', complexName);

      await page.evaluate(() => {
        const submitBtn = document.querySelector('section.lg\\:col-span-4 form button[type="submit"]');
        submitBtn.click();
      });
      await new Promise(r => setTimeout(r, 200));

      // Check that script tag did NOT execute and is escaped as text
      const zoneBHtml = await page.$eval('section.lg\\:col-span-4', el => el.innerHTML);
      assert.ok(zoneBHtml.includes('&lt;script&gt;') || !zoneBHtml.includes('<script>alert'), 'Script tag must be safely sanitized as text');
      assert.ok(zoneBHtml.includes('Álvaro José'), 'Unicode accented name must be preserved');

      await page.close();
    });

    await asyncTest('Queue Seating: 1-Tap "Sentar Siguiente" seats top client into available chair (CH-02)', async () => {
      const page = await createCleanPage(browser, url);

      // CH-02 is initially WALKIN (available) and queue has Hugo Navarro
      const seatBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('section.lg\\:col-span-8 button'));
        const btn = btns.find(b => b.textContent.includes('Sentar Siguiente'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      assert.strictEqual(seatBtn, true, '"Sentar Siguiente" button must exist on available chair');

      await new Promise(r => setTimeout(r, 200));

      // Verify CH-02 now has Hugo Navarro seated
      const ch2Text = await page.evaluate(() => {
        const cards = document.querySelectorAll('section.lg\\:col-span-8 .luxury-card');
        return cards[1].textContent;
      });
      assert.ok(ch2Text.includes('Hugo Navarro'), `CH-02 should have Hugo Navarro seated, got: ${ch2Text}`);
      assert.ok(ch2Text.includes('EN CORTE // FADE'), `CH-02 status should transition to EN CORTE // FADE, got: ${ch2Text}`);

      // Verify queue length decremented (from 2 to 1)
      const headerText = await page.$eval('main header', el => el.textContent);
      assert.ok(headerText.includes('1 EN COLA VIVA'), `Queue header should now show 1 EN COLA VIVA, got: ${headerText}`);
      assert.ok(headerText.includes('3/3 SILLONES ACTIVOS'), `All 3 chairs should now be active (3/3), got: ${headerText}`);

      // Notice should be displayed
      const noticeText = await page.evaluate(() => {
        const n = document.querySelector('.fixed.top-12.right-6');
        return n ? n.textContent : '';
      });
      assert.ok(noticeText.includes('Hugo Navarro sentado en CH-02'), `Notice should confirm Hugo seated, got: ${noticeText}`);

      await page.close();
    });

    await asyncTest('Queue Exhaustion: Seating all clients leaves queue in "Cola Despejada" state gracefully', async () => {
      const page = await createCleanPage(browser, url);

      // 1. Seat Hugo Navarro into CH-02
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('section.lg\\:col-span-8 button'))
          .find(b => b.textContent.includes('Sentar Siguiente'));
        btn.click();
      });
      await new Promise(r => setTimeout(r, 200));

      // 2. Make CH-01 available by clicking it once (from CUTTING to WALKIN)
      await page.evaluate(() => {
        const cycleBtn = document.querySelectorAll('section button[title*="rotar estado"]')[0];
        cycleBtn.click();
      });
      await new Promise(r => setTimeout(r, 200));

      // 3. Seat next client (Carlos "Capi" Ruiz) into CH-01
      const seatedSecond = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('section.lg\\:col-span-8 button'))
          .find(b => b.textContent.includes('Sentar Siguiente'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      assert.strictEqual(seatedSecond, true, 'Second "Sentar Siguiente" must be clickable');
      await new Promise(r => setTimeout(r, 200));

      // 4. Verify queue is now empty
      const zoneBContent = await page.$eval('section.lg\\:col-span-4', el => el.textContent);
      assert.ok(zoneBContent.includes('Cola Despejada'), `Queue should be empty with "Cola Despejada", got: ${zoneBContent}`);

      // 5. Verify no "Sentar Siguiente" buttons remain
      const remainingSeatBtns = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button'))
          .filter(b => b.textContent.includes('Sentar Siguiente')).length;
      });
      assert.strictEqual(remainingSeatBtns, 0, 'No "Sentar Siguiente" buttons should remain when queue is empty');

      await page.close();
    });

    await asyncTest('Queue WhatsApp & Dismiss: WhatsApp trigger and discard action execute safely', async () => {
      const page = await createCleanPage(browser, url);

      // Click "Avisar WhatsApp"
      await page.evaluate(() => {
        const waBtn = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.includes('Avisar WhatsApp'));
        if (waBtn) waBtn.click();
      });
      await new Promise(r => setTimeout(r, 100));

      const waCalls = await page.evaluate(() => window.__waCalls);
      assert.ok(waCalls && waCalls.length > 0, 'WhatsApp window.open should be triggered');
      assert.ok(waCalls[0].url.includes('wa.me/34622334455'), `Expected WhatsApp url with phone, got: ${waCalls[0].url}`);

      // Click "Descartar"
      await page.evaluate(() => {
        const discardBtn = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.includes('Descartar'));
        if (discardBtn) discardBtn.click();
      });
      await new Promise(r => setTimeout(r, 150));

      const headerText = await page.$eval('main header', el => el.textContent);
      assert.ok(headerText.includes('1 EN COLA VIVA'), `Queue should decrement to 1 after discard, got: ${headerText}`);

      await page.close();
    });

    // ========================================================================
    // SUITE 3: SECONDARY DRAWER TOGGLING UNDER RAPID EXPAND/COLLAPSE
    // ========================================================================
    console.log('\n--- SUITE 3: Secondary Drawer Toggling Under Rapid Expand/Collapse ---');

    await asyncTest('Drawer Toggling: All 3 drawers are collapsed by default on initial render', async () => {
      const page = await createCleanPage(browser, url);

      const drawerStates = await page.evaluate(() => {
        const drawerTexts = Array.from(document.querySelectorAll('button'))
          .filter(b => b.textContent.includes('MÓDULO 0'));
        
        const hasTelemetryCards = !!document.querySelector('.grid.grid-cols-2.lg\\:grid-cols-4');
        const hasVaultButtons = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Exportar JSON'));
        const hasRgpdBadges = Array.from(document.querySelectorAll('span')).some(s => s.textContent.includes('ENCRIPTADO LOCAL'));

        return {
          drawerButtonCount: drawerTexts.length,
          hasTelemetryCards,
          hasVaultButtons,
          hasRgpdBadges
        };
      });

      assert.strictEqual(drawerStates.drawerButtonCount, 3, 'Must have 3 collapsible drawer triggers');
      assert.strictEqual(drawerStates.hasTelemetryCards, false, 'Telemetry content must be collapsed');
      assert.strictEqual(drawerStates.hasVaultButtons, false, 'Vault content must be collapsed');
      assert.strictEqual(drawerStates.hasRgpdBadges, false, 'RGPD content must be collapsed');

      await page.close();
    });

    await asyncTest('Drawer Toggling: 100 rapid toggles on Drawer 1 preserves even parity (closed)', async () => {
      const page = await createCleanPage(browser, url);

      const result = await page.evaluate(async () => {
        const toggleBtn = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.includes('MÓDULO 01'));
        
        for (let i = 0; i < 100; i++) {
          toggleBtn.click();
        }
        await new Promise(r => setTimeout(r, 150));

        const hasTelemetryCards = !!document.querySelector('.grid.grid-cols-2.lg\\:grid-cols-4');
        return { hasTelemetryCards };
      });

      assert.strictEqual(result.hasTelemetryCards, false, 'Even number of toggles (100) must return drawer to closed state');
      await page.close();
    });

    await asyncTest('Drawer Toggling: 101 rapid toggles on Drawer 1 leaves drawer expanded (odd parity)', async () => {
      const page = await createCleanPage(browser, url);

      const result = await page.evaluate(async () => {
        const toggleBtn = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.includes('MÓDULO 01'));
        
        for (let i = 0; i < 101; i++) {
          toggleBtn.click();
        }
        await new Promise(r => setTimeout(r, 150));

        const hasTelemetryCards = !!document.querySelector('.grid.grid-cols-2.lg\\:grid-cols-4');
        const telemetryCardsCount = document.querySelectorAll('.grid.grid-cols-2.lg\\:grid-cols-4 > div').length;
        return { hasTelemetryCards, telemetryCardsCount };
      });

      assert.strictEqual(result.hasTelemetryCards, true, 'Odd number of toggles (101) must leave drawer open');
      assert.strictEqual(result.telemetryCardsCount, 4, 'Must render all 4 telemetry cards (SYS.01 - SYS.04)');
      await page.close();
    });

    await asyncTest('Drawer Layout Stability: Simultaneous expansion of all 3 drawers creates NO horizontal overflow', async () => {
      const page = await createCleanPage(browser, url);

      // Expand all 3 drawers
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
          .filter(b => b.textContent.includes('MÓDULO 0'));
        buttons.forEach(b => b.click());
      });
      await new Promise(r => setTimeout(r, 200));

      const layoutMetrics = await page.evaluate(() => {
        const docEl = document.documentElement;
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
          hasHorizontalScroll: docEl.scrollWidth > docEl.clientWidth
        };
      });

      assert.strictEqual(layoutMetrics.hasHorizontalScroll, false, 
        `Layout overflow detected: scrollWidth ${layoutMetrics.scrollWidth} > clientWidth ${layoutMetrics.clientWidth}`
      );
      await page.close();
    });

    await asyncTest('Drawer Responsive Layout: Zero horizontal overflow across mobile (390px), tablet (768px), and 4K (1920px)', async () => {
      const testBreakpoints = [
        { name: 'Mobile (iPhone 14)', width: 390, height: 844 },
        { name: 'Tablet (iPad)', width: 768, height: 1024 },
        { name: 'Desktop (Laptop)', width: 1280, height: 800 },
        { name: 'Ultra-Wide / 4K', width: 1920, height: 1080 }
      ];

      for (const bp of testBreakpoints) {
        const page = await createCleanPage(browser, url, bp.width, bp.height);

        // Expand all drawers
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))
            .filter(b => b.textContent.includes('MÓDULO 0'));
          buttons.forEach(b => b.click());
        });
        await new Promise(r => setTimeout(r, 100));

        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        assert.strictEqual(overflow, false, `Horizontal overflow at breakpoint ${bp.name} (${bp.width}px)`);
        await page.close();
      }
    });

    // ========================================================================
    // SUITE 4: COGNITIVE GLANCE METRICS (<3s SCAN, PRIMARY ABOVE THE FOLD)
    // ========================================================================
    console.log('\n--- SUITE 4: Cognitive Glance Metrics (<3s Scan, Primary Above the Fold) ---');

    await asyncTest('Cognitive Glance: Header and Zone A & B operational zones sit above the 800px viewport fold', async () => {
      const page = await createCleanPage(browser, url, 1280, 800);

      const bounds = await page.evaluate(() => {
        const header = document.querySelector('main header');
        const zoneA = document.querySelector('section.lg\\:col-span-8');
        const zoneB = document.querySelector('section.lg\\:col-span-4');

        const hRect = header.getBoundingClientRect();
        const aRect = zoneA.getBoundingClientRect();
        const bRect = zoneB.getBoundingClientRect();

        return {
          header: { top: hRect.top, bottom: hRect.bottom, height: hRect.height },
          zoneA: { top: aRect.top, bottom: aRect.bottom, height: aRect.height },
          zoneB: { top: bRect.top, bottom: bRect.bottom, height: bRect.height }
        };
      });

      // Header should be anchored at top of main view
      assert.ok(bounds.header.top >= 0 && bounds.header.top <= 100, `Header top out of range: ${bounds.header.top}`);
      assert.ok(bounds.header.bottom <= 220, `Header bottom too deep: ${bounds.header.bottom}`);

      // Zone A (Chairs) starts immediately below header and fits on screen
      assert.ok(bounds.zoneA.top < 250, `Zone A top too deep: ${bounds.zoneA.top}`);
      assert.ok(bounds.zoneA.bottom <= 600, `Zone A bottom exceeds fold: ${bounds.zoneA.bottom}`);

      // Zone B (Queue) starts immediately below header and fits on screen
      assert.ok(bounds.zoneB.top < 250, `Zone B top too deep: ${bounds.zoneB.top}`);
      assert.ok(bounds.zoneB.bottom <= 700, `Zone B bottom exceeds fold: ${bounds.zoneB.bottom}`);

      console.log(`    [Metrics] Header Bottom: ${Math.round(bounds.header.bottom)}px | Zone A Bottom: ${Math.round(bounds.zoneA.bottom)}px | Zone B Bottom: ${Math.round(bounds.zoneB.bottom)}px (<800px Fold)`);
      await page.close();
    });

    await asyncTest('Cognitive Glance: Primary focal anchors <= 5 and secondary administrative clutter is 0 above fold', async () => {
      const page = await createCleanPage(browser, url, 1280, 800);

      const focalAudit = await page.evaluate(() => {
        // Collect visible elements whose top is < 800px
        const sections = Array.from(document.querySelectorAll('main header, main section'));
        const visibleAboveFold = sections.filter(el => {
          const r = el.getBoundingClientRect();
          return r.top >= 0 && r.top < 800;
        });

        // Check if raw administrative tables or dense JSON editors exist above fold
        const rawJsonViews = document.querySelectorAll('pre, textarea');
        const administrativeTables = document.querySelectorAll('table');

        return {
          visibleSectionsCount: visibleAboveFold.length,
          rawJsonViewsAboveFold: rawJsonViews.length,
          administrativeTablesCount: administrativeTables.length
        };
      });

      // Primary focal anchors: Header (1), Zone A Chairs (2), Zone B Queue (3), Zone C Bento Cards (4)
      assert.ok(focalAudit.visibleSectionsCount <= 5, 
        `Too many sections above fold creating cognitive noise: ${focalAudit.visibleSectionsCount}`
      );
      assert.strictEqual(focalAudit.rawJsonViewsAboveFold, 0, 'No raw JSON / pre tags should clutter primary view');
      assert.strictEqual(focalAudit.administrativeTablesCount, 0, 'No dense admin tables should clutter primary view');

      await page.close();
    });

    await asyncTest('Cognitive Glance: Page load, FCP, cold-start and steady-state latency achieve <3s scan requirement', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      
      const loadStart = performance.now();
      await page.goto(url, { waitUntil: 'networkidle0' });
      const loadDuration = Math.round(performance.now() - loadStart);

      // Measure cold-start latency (includes first-time AudioContext OS initialization)
      const coldStartLatency = await page.evaluate(() => {
        const btn = document.querySelectorAll('section button[title*="rotar estado"]')[0];
        const t0 = performance.now();
        btn.click();
        const t1 = performance.now();
        return Math.round((t1 - t0) * 100) / 100;
      });

      // Measure steady-state click response latency
      const steadyStateLatency = await page.evaluate(() => {
        const btn = document.querySelectorAll('section button[title*="rotar estado"]')[0];
        const t0 = performance.now();
        btn.click();
        const t1 = performance.now();
        return Math.round((t1 - t0) * 100) / 100;
      });

      // Measure click response latency for drawer toggle
      const drawerLatency = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.includes('MÓDULO 01'));
        const t0 = performance.now();
        btn.click();
        const t1 = performance.now();
        return Math.round((t1 - t0) * 100) / 100;
      });

      assert.ok(loadDuration < 2000, `Initial page load exceeds 2000ms: ${loadDuration}ms`);
      assert.ok(coldStartLatency < 500, `Cold-start latency exceeds 500ms: ${coldStartLatency}ms`);
      assert.ok(steadyStateLatency < 50, `Steady-state click latency exceeds 50ms: ${steadyStateLatency}ms`);
      assert.ok(drawerLatency < 50, `Drawer toggle latency exceeds 50ms: ${drawerLatency}ms`);

      console.log(`    [Metrics] Page Load: ${loadDuration}ms | Cold-Start Click: ${coldStartLatency}ms | Steady-State Click: ${steadyStateLatency}ms | Drawer Toggle: ${drawerLatency}ms`);
      await page.close();
    });

  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n================================================================');
  console.log(`CHALLENGER M3 RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Fatal stress suite runner error:', err);
  process.exit(1);
});
