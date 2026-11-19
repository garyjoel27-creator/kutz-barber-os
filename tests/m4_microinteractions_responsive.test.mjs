/**
 * Milestone M4 Verification Suite:
 * - 60 FPS GPU Acceleration & Hardware Transform Utilities
 * - Audio & Tactile Haptic Feedback (soundFx.playFlip, soundFx.playClick, soundFx.triggerHaptic(10))
 * - Tablet 768px Responsiveness: Chair stations >= 200px width, zero overflow, wrapped buttons
 * - Mobile Ergonomics (~390px): 0 horizontal scroll overflow, min 44px touch targets
 * - Diacritic Normalization in CommandPalette (Ctrl+K): unaccented search matches accented clients
 */

import assert from 'node:assert';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');

console.log('================================================================');
console.log('MILESTONE M4: MICRO-INTERACTIONS & RESPONSIVE EMPIRICAL SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Static Static Source Code & CSS Contract Tests
// ---------------------------------------------------------------------------
console.log('--- Static Code Architecture & GPU Acceleration Verification ---');

await test('M4.S1: index.css defines 3D transform utilities and .gpu-accelerated class', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'src', 'index.css'), 'utf8');
  assert.ok(css.includes('.perspective-1000'), 'Must include .perspective-1000');
  assert.ok(css.includes('transform-style: preserve-3d'), 'Must include transform-style: preserve-3d');
  assert.ok(css.includes('backface-visibility: hidden'), 'Must include backface-visibility: hidden');
  assert.ok(css.includes('-webkit-backface-visibility: hidden'), 'Must include -webkit-backface-visibility: hidden');
  assert.ok(css.includes('will-change: transform'), 'Must include will-change: transform');
  assert.ok(css.includes('.gpu-accelerated'), 'Must include .gpu-accelerated utility class');
});

await test('M4.S2: Dashboard.jsx uses grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 and GPU acceleration on chairs', () => {
  const src = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'Dashboard.jsx'), 'utf8');
  assert.ok(src.includes('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5'), 'Chairs container must use grid-cols-1 sm:grid-cols-2 xl:grid-cols-3');
  assert.ok(src.includes("willChange: 'transform'"), 'Chair cards must use willChange: transform');
  assert.ok(src.includes("transformStyle: 'preserve-3d'"), 'Chair cards must use transformStyle: preserve-3d');
  assert.ok(src.includes("WebkitBackfaceVisibility: 'hidden'"), 'Chair cards must use WebkitBackfaceVisibility: hidden');
  assert.ok(src.includes('flex flex-wrap items-start justify-between'), 'Chair card header must use flex-wrap to prevent button overflow');
  assert.ok(src.includes('max-w-full'), 'Status button must have max-w-full boundary constraint');
});

await test('M4.S3: Dashboard.jsx wires soundFx.playClick and soundFx.triggerHaptic(10) on chair cycle and drawers', () => {
  const src = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'Dashboard.jsx'), 'utf8');
  assert.ok(src.includes('handleCycleChairStatus'), 'handleCycleChairStatus must exist');
  assert.ok(src.includes('soundFx.triggerHaptic(10)'), 'Must call soundFx.triggerHaptic(10)');
  assert.ok(src.includes('soundFx.playClick()'), 'Must call soundFx.playClick()');
});

await test('M4.S4: CommandPalette.jsx applies normalizeText diacritic stripping to searches', () => {
  const src = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'CommandPalette.jsx'), 'utf8');
  assert.ok(src.includes('normalizeText'), 'CommandPalette must import/define normalizeText');
  assert.ok(src.includes('normalizeText(query)'), 'CommandPalette must normalize the search query');
  assert.ok(src.includes('normQuery'), 'CommandPalette must match against normalized query');
  assert.ok(src.includes('soundFx.triggerHaptic(10)'), 'CommandPalette must trigger haptic feedback');
});

await test('M4.S5: WalkInKioskModal.jsx includes GPU acceleration and soundFx audio/haptic feedback', () => {
  const src = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'WalkInKioskModal.jsx'), 'utf8');
  assert.ok(src.includes("willChange: 'transform, opacity'"), 'Kiosk must use willChange: transform, opacity');
  assert.ok(src.includes("transformStyle: 'preserve-3d'"), 'Kiosk must use transformStyle: preserve-3d');
  assert.ok(src.includes('soundFx.playClick()'), 'Kiosk must invoke soundFx.playClick');
  assert.ok(src.includes('soundFx.triggerHaptic(10)'), 'Kiosk must invoke soundFx.triggerHaptic(10)');
});

// ---------------------------------------------------------------------------
// Empirical Headless Puppeteer Browser Tests
// ---------------------------------------------------------------------------
function startStaticServer(port = 4181) {
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
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      let filePath = path.join(distDir, reqPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(filePath));
    });

    server.listen(port, () => resolve(server));
  });
}

const port = 4181;
const server = await startStaticServer(port);
const baseUrl = `http://localhost:${port}`;
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
  const page = await browser.newPage();

  console.log('\n--- Empirical Tablet (768px) Stress & Squeeze Verification ---');

  await test('M4.E1: Tablet 768px achieves zero horizontal scroll (scrollWidth <= 768px)', async () => {
    await page.setViewport({ width: 768, height: 1024, isMobile: true, hasTouch: true });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.strictEqual(scrollWidth, 768, `Tablet scrollWidth (${scrollWidth}) exceeds 768`);
  });

  await test('M4.E2: Tablet 768px chair cards maintain >= 200px width with 0px button overflow', async () => {
    const chairMetrics = await page.evaluate(() => {
      const chairSection = Array.from(document.querySelectorAll('section')).find(s => s.textContent.includes('ESTADO DE SILLONES'));
      const cards = Array.from(chairSection.querySelectorAll('.luxury-card'));

      return cards.map((card, idx) => {
        const rect = card.getBoundingClientRect();
        const button = card.querySelector('button');
        const buttonRect = button ? button.getBoundingClientRect() : null;
        return {
          idx,
          cardWidth: Math.round(rect.width),
          cardScrollWidth: card.scrollWidth,
          overflows: card.scrollWidth > rect.width,
          overflowDelta: Math.max(0, card.scrollWidth - Math.round(rect.width)),
          buttonWidth: buttonRect ? Math.round(buttonRect.width) : 0,
          buttonText: button ? button.textContent.trim() : ''
        };
      });
    });

    console.log('    Measured Tablet 768px Chair Metrics:');
    chairMetrics.forEach(c => {
      console.log(`    - Chair ${c.idx}: width=${c.cardWidth}px, scrollWidth=${c.cardScrollWidth}px, overflows=${c.overflows} (delta: ${c.overflowDelta}px), button="${c.buttonText}" (${c.buttonWidth}px)`);
    });

    // Check chair card width is >= 200px on tablet
    assert.ok(chairMetrics[0].cardWidth >= 200, `Chair card width (${chairMetrics[0].cardWidth}px) must be >= 200px`);
    
    // Check 0 overflow on all cards
    const overflowing = chairMetrics.filter(c => c.overflows);
    assert.strictEqual(overflowing.length, 0, `All chair cards must have 0 overflow (found ${overflowing.length} overflowing)`);
  });

  console.log('\n--- Empirical Mobile (~390px) Ergonomics & Touch Targets ---');

  await test('M4.E3: Mobile 390px achieves zero horizontal scroll (scrollWidth === 390px)', async () => {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.strictEqual(scrollWidth, 390, `Mobile scrollWidth (${scrollWidth}) exceeds 390`);
  });

  await test('M4.E4: Mobile 390px bottom navigation achieves >= 50px touch height', async () => {
    const navHeight = await page.evaluate(() => {
      const nav = document.querySelector('nav.md\\:hidden, nav.fixed, nav');
      const bottomNav = Array.from(document.querySelectorAll('nav')).find(n => {
        const r = n.getBoundingClientRect();
        return r.height > 0 && r.bottom <= window.innerHeight + 5;
      }) || nav;
      return bottomNav ? Math.round(bottomNav.getBoundingClientRect().height) : 0;
    });
    assert.ok(navHeight >= 50, `Mobile navigation height (${navHeight}px) must be >= 50px`);
  });

  console.log('\n--- Empirical Desktop (1280px+) 3-Column Layout ---');

  await test('M4.E5: Desktop 1280px displays chairs in 3 horizontal columns with Zone A & B side-by-side', async () => {
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

    const layout = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('section'));
      const chairSection = sections.find(s => s.textContent.includes('ESTADO DE SILLONES'));
      const queueSection = sections.find(s => s.textContent.includes('COLA VIVA'));
      const chairCards = Array.from(chairSection.querySelectorAll('.luxury-card'));

      const chairBox = chairSection.getBoundingClientRect();
      const queueBox = queueSection.getBoundingClientRect();
      const cardBoxes = chairCards.map(c => c.getBoundingClientRect());

      return {
        cardCount: chairCards.length,
        sameRow: cardBoxes.length === 3 && Math.abs(cardBoxes[0].top - cardBoxes[1].top) < 5 && Math.abs(cardBoxes[1].top - cardBoxes[2].top) < 5,
        isSideBySide: Math.abs(chairBox.top - queueBox.top) < 50 && chairBox.right <= queueBox.left + 30
      };
    });

    assert.strictEqual(layout.cardCount, 3, 'Must render 3 chair cards');
    assert.ok(layout.sameRow, 'All 3 chairs must be on same horizontal row on desktop');
    assert.ok(layout.isSideBySide, 'Zone A and Zone B must be side-by-side on desktop');
  });

  console.log('\n--- Empirical Diacritic Search Normalization in CommandPalette ---');

  await test('M4.E6: Unaccented search "alex" matches "Álex Rivera" in CommandPalette (Ctrl+K)', async () => {
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

    // Open CommandPalette with Ctrl+K
    await page.keyboard.down('Control');
    await page.keyboard.press('k');
    await page.keyboard.up('Control');
    await new Promise(r => setTimeout(r, 200));

    const cmdInput = await page.$('.luxury-card input[placeholder*="Buscar"]');
    assert.ok(cmdInput, 'CommandPalette search input must exist');

    await page.evaluate(el => el.value = '', cmdInput);
    await cmdInput.type('alex');
    await new Promise(r => setTimeout(r, 150));

    const matchFound = await page.evaluate(() => {
      const modal = document.querySelector('.luxury-card.max-w-xl');
      if (!modal) return false;
      const clientButtons = Array.from(modal.querySelectorAll('button'));
      return clientButtons.some(b => b.textContent.includes('Álex Rivera') && !b.textContent.includes('Ficha Estrella Demo'));
    });

    console.log(`    CommandPalette search for "alex" -> matched "Álex Rivera": ${matchFound}`);
    assert.strictEqual(matchFound, true, 'Unaccented search "alex" must match accented client "Álex Rivera"');
  });

  await test('M4.E7: Unaccented search "dani" matches "Dani Morales" in CommandPalette (Ctrl+K)', async () => {
    const cmdInput = await page.$('.luxury-card input[placeholder*="Buscar"]');
    assert.ok(cmdInput, 'CommandPalette search input must exist');

    await page.evaluate(el => el.value = '', cmdInput);
    await cmdInput.type('dani');
    await new Promise(r => setTimeout(r, 150));

    const matchFound = await page.evaluate(() => {
      const modal = document.querySelector('.luxury-card.max-w-xl');
      if (!modal) return false;
      const clientButtons = Array.from(modal.querySelectorAll('button'));
      return clientButtons.some(b => b.textContent.includes('Dani Morales'));
    });

    console.log(`    CommandPalette search for "dani" -> matched "Dani Morales": ${matchFound}`);
    assert.strictEqual(matchFound, true, 'Search "dani" must match client "Dani Morales"');
  });

} finally {
  await browser.close();
  server.close();
}

console.log('\n================================================================');
console.log(`MILESTONE M4 TEST RESULTS: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
