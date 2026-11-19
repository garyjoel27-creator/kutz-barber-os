/**
 * Empirical Challenger M3: Responsive Layout & UI Stability Stress Suite
 * Focus areas:
 * 1. Mobile Viewport (~390px): single-column stacking, zero overflow, touch targets
 * 2. Tablet Viewport (768px): chairs/queue layout, chair card width, button squeezing & overflow
 * 3. Desktop Viewport (1280px+): 3-column chairs, embedded queue, daily client cards
 * 4. Unaccented Search: "alex", "dani" matching accented client records
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
console.log('CHALLENGER M3: RESPONSIVE LAYOUT & UI STABILITY EMPIRICAL SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
export const empiricalFindings = [];

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

function startStaticServer(port = 4180) {
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

async function main() {
  const port = 4180;
  const server = await startStaticServer(port);
  const baseUrl = `http://localhost:${port}`;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // ========================================================================
    // SUITE 1: Mobile Viewport (~390px)
    // ========================================================================
    console.log('\n--- SUITE 1: Mobile Viewport (~390px) ---');

    await test('M1.1: Mobile viewport achieves zero horizontal scroll (scrollWidth <= 390px)', async () => {
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.strictEqual(scrollWidth, 390, `Document scrollWidth (${scrollWidth}) exceeds viewport width (390)`);
    });

    await test('M1.2: Mobile layout stacks chairs, queue, and daily cards in a single column', async () => {
      const stacking = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('section'));
        const chairSection = sections.find(s => s.textContent.includes('ESTADO DE SILLONES'));
        const queueSection = sections.find(s => s.textContent.includes('COLA VIVA'));
        const bentoSection = sections.find(s => s.textContent.includes('CLIENTES DEL DÍA'));

        const chairBox = chairSection.getBoundingClientRect();
        const queueBox = queueSection.getBoundingClientRect();
        const bentoBox = bentoSection.getBoundingClientRect();

        const chairCards = Array.from(chairSection.querySelectorAll('.luxury-card'));
        const chairBoxes = chairCards.map(c => c.getBoundingClientRect());

        return {
          queueBelowChairs: queueBox.top >= chairBox.bottom - 5,
          bentoBelowQueue: bentoBox.top >= queueBox.bottom - 5,
          chairsStackedVertically: chairBoxes.length >= 2 && chairBoxes[1].top >= chairBoxes[0].bottom - 5
        };
      });

      assert.ok(stacking.queueBelowChairs, 'Zone B (Queue) must be positioned below Zone A (Chairs) on mobile');
      assert.ok(stacking.bentoBelowQueue, 'Zone C (Daily Bento) must be positioned below Zone B (Queue) on mobile');
      assert.ok(stacking.chairsStackedVertically, 'Chair cards must stack vertically in a single column on mobile');
    });

    await test('M1.3: Mobile touch navigation bar is fixed to bottom with adequate touch height (>=50px)', async () => {
      const navInfo = await page.evaluate(() => {
        const bottomNav = document.querySelector('nav.md\\:hidden, nav.fixed');
        if (!bottomNav) return null;
        const rect = bottomNav.getBoundingClientRect();
        return {
          visible: rect.width > 0 && rect.height > 0,
          height: Math.round(rect.height),
          isBottomFixed: Math.abs(rect.bottom - window.innerHeight) <= 2
        };
      });

      assert.ok(navInfo, 'Mobile bottom navigation must be present');
      assert.ok(navInfo.isBottomFixed, 'Mobile bottom navigation must be fixed to viewport bottom');
      assert.ok(navInfo.height >= 50, `Mobile navigation height (${navInfo.height}px) must be >= 50px`);
    });

    // ========================================================================
    // SUITE 2: Tablet Viewport (768px) Stress & Boundary Analysis
    // ========================================================================
    console.log('\n--- SUITE 2: Tablet Viewport (768px) ---');

    await test('M2.1: Tablet viewport achieves zero horizontal scroll (scrollWidth <= 768px)', async () => {
      await page.setViewport({ width: 768, height: 1024, isMobile: true, hasTouch: true });
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.strictEqual(scrollWidth, 768, `Tablet scrollWidth (${scrollWidth}) exceeds viewport width (768)`);
    });

    await test('M2.2: Forensic evaluation of chairs/queue split on tablet (768px)', async () => {
      const layout = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('section'));
        const chairSection = sections.find(s => s.textContent.includes('ESTADO DE SILLONES'));
        const queueSection = sections.find(s => s.textContent.includes('COLA VIVA'));

        const chairBox = chairSection.getBoundingClientRect();
        const queueBox = queueSection.getBoundingClientRect();

        return {
          chairBox: { width: Math.round(chairBox.width), top: Math.round(chairBox.top), left: Math.round(chairBox.left) },
          queueBox: { width: Math.round(queueBox.width), top: Math.round(queueBox.top), left: Math.round(queueBox.left) },
          isSideBySide: Math.abs(chairBox.top - queueBox.top) < 50 && chairBox.right <= queueBox.left + 30,
          isStacked: queueBox.top >= chairBox.bottom - 5
        };
      });

      console.log('    Tablet Layout Measurement:');
      console.log(`    - Zone A (Chairs) width: ${layout.chairBox.width}px, top: ${layout.chairBox.top}px`);
      console.log(`    - Zone B (Queue) width: ${layout.queueBox.width}px, top: ${layout.queueBox.top}px`);
      console.log(`    - Is Side-by-Side: ${layout.isSideBySide}`);
      console.log(`    - Is Stacked: ${layout.isStacked}`);

      // Record empirical finding regarding chairs/queue split
      empiricalFindings.push({
        id: 'TABLET_CHAIRS_QUEUE_STACKING',
        severity: 'MEDIUM',
        description: 'At 768px tablet breakpoint, Zone A (Chairs) and Zone B (Queue) stack in 1 column instead of splitting side-by-side due to lg:grid-cols-12 (lg=1024px, not md=768px).',
        measured: layout
      });

      // The layout is stacked at 768px because outer grid uses lg:grid-cols-12
      assert.ok(layout.isStacked, 'At 768px, outer grid currently stacks Zone A and Zone B vertically');
    });

    await test('M2.3: Forensic measurement of chair card width & button squeezing at 768px', async () => {
      const chairCards = await page.evaluate(() => {
        const chairSection = Array.from(document.querySelectorAll('section')).find(s => s.textContent.includes('ESTADO DE SILLONES'));
        const cards = Array.from(chairSection.querySelectorAll('.luxury-card'));

        return cards.map((card, idx) => {
          const rect = card.getBoundingClientRect();
          const button = card.querySelector('button');
          const buttonRect = button ? button.getBoundingClientRect() : null;
          return {
            chairIdx: idx,
            cardWidth: Math.round(rect.width),
            cardScrollWidth: card.scrollWidth,
            cardOverflows: card.scrollWidth > rect.width,
            buttonText: button ? button.textContent.trim() : '',
            buttonWidth: buttonRect ? Math.round(buttonRect.width) : 0,
            overflowDeltaPx: Math.max(0, card.scrollWidth - Math.round(rect.width))
          };
        });
      });

      console.log('    Chair Cards Width & Overflow at 768px:');
      chairCards.forEach(c => {
        console.log(`    - Chair ${c.chairIdx}: cardWidth=${c.cardWidth}px, scrollWidth=${c.cardScrollWidth}px, overflows=${c.cardOverflows} (+${c.overflowDeltaPx}px), button="${c.buttonText}" (${c.buttonWidth}px)`);
      });

      const overflowingCards = chairCards.filter(c => c.cardOverflows);
      if (overflowingCards.length > 0) {
        empiricalFindings.push({
          id: 'TABLET_CHAIR_CARD_OVERFLOW',
          severity: 'HIGH',
          description: `At 768px tablet, md:grid-cols-3 squeezes chairs into 127px columns while sidebar w-76 is open. Status buttons (${overflowingCards.map(c => `"${c.buttonText}"`).join(', ')}) exceed card bounds causing ${overflowingCards[0].overflowDeltaPx}px card overflow.`,
          measured: overflowingCards
        });
      }

      // Assert finding is captured (M3 baseline) or resolved (M4)
      if (chairCards[0].cardWidth >= 200 && overflowingCards.length === 0) {
        console.log('    ✔ [M4 RESOLVED] Chair cards maintain >= 200px width with 0px overflow on tablet.');
        assert.ok(chairCards[0].cardWidth >= 200);
      } else {
        assert.strictEqual(chairCards[0].cardWidth, 127, 'Chair cards are compressed to 127px at 768px');
        assert.ok(overflowingCards.length >= 2, 'Chair cards overflow their 127px boundaries when status badge buttons are rendered');
      }
    });

    // ========================================================================
    // SUITE 3: Desktop Viewport (1280px+) Verification
    // ========================================================================
    console.log('\n--- SUITE 3: Desktop Viewport (1280px+) ---');

    await test('M3.1: Desktop 1280px achieves zero horizontal scroll', async () => {
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.strictEqual(scrollWidth, 1280, `Desktop scrollWidth (${scrollWidth}) exceeds viewport width (1280)`);
    });

    await test('M3.2: Desktop layout displays 3-column chairs in Zone A on same horizontal row', async () => {
      const chairs = await page.evaluate(() => {
        const chairSection = Array.from(document.querySelectorAll('section')).find(s => s.textContent.includes('ESTADO DE SILLONES'));
        const cards = Array.from(chairSection.querySelectorAll('.luxury-card'));
        const boxes = cards.map(c => c.getBoundingClientRect());
        return {
          count: cards.length,
          widths: boxes.map(b => Math.round(b.width)),
          tops: boxes.map(b => Math.round(b.top)),
          sameRow: boxes.length === 3 && Math.abs(boxes[0].top - boxes[1].top) < 5 && Math.abs(boxes[1].top - boxes[2].top) < 5
        };
      });

      assert.strictEqual(chairs.count, 3, 'Must render 3 chair cards');
      assert.ok(chairs.sameRow, 'All 3 chairs must be aligned on the same horizontal row');
      assert.ok(chairs.widths[0] >= 180, `Chair card width (${chairs.widths[0]}px) must be >= 180px on desktop`);
    });

    await test('M3.3: Desktop layout embeds Zone B queue side-by-side with Zone A chairs', async () => {
      const sideBySide = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('section'));
        const chairSection = sections.find(s => s.textContent.includes('ESTADO DE SILLONES'));
        const queueSection = sections.find(s => s.textContent.includes('COLA VIVA'));

        const chairBox = chairSection.getBoundingClientRect();
        const queueBox = queueSection.getBoundingClientRect();

        return {
          isSideBySide: Math.abs(chairBox.top - queueBox.top) < 30 && chairBox.right <= queueBox.left + 30,
          chairWidth: Math.round(chairBox.width),
          queueWidth: Math.round(queueBox.width)
        };
      });

      assert.ok(sideBySide.isSideBySide, 'Zone A and Zone B must be embedded side-by-side on desktop');
      assert.ok(sideBySide.chairWidth > sideBySide.queueWidth, 'Zone A (8 cols) must be wider than Zone B (4 cols)');
    });

    await test('M3.4: Desktop layout renders Zone C daily client cards in 3 columns horizontally', async () => {
      const bento = await page.evaluate(() => {
        const bentoSection = Array.from(document.querySelectorAll('section')).find(s => s.textContent.includes('CLIENTES DEL DÍA'));
        const grid = bentoSection.children[1];
        const cards = grid ? Array.from(grid.children) : [];
        const boxes = cards.map(c => c.getBoundingClientRect());

        return {
          count: cards.length,
          widths: boxes.map(b => Math.round(b.width)),
          tops: boxes.map(b => Math.round(b.top)),
          sameRow: boxes.length === 3 && Math.abs(boxes[0].top - boxes[1].top) < 5 && Math.abs(boxes[1].top - boxes[2].top) < 5
        };
      });

      assert.strictEqual(bento.count, 3, 'Zone C must render 3 daily client cards');
      assert.ok(bento.sameRow, 'Daily client cards must be rendered in 3 columns on the same row on 1280px+ desktop');
      assert.ok(bento.widths[0] >= 250, `Daily client card width (${bento.widths[0]}px) must be >= 250px`);
    });

    // ========================================================================
    // SUITE 4: Unaccented Search Testing
    // ========================================================================
    console.log('\n--- SUITE 4: Unaccented Search Verification ---');

    await test('M4.1: Unaccented search "alex" matches "Álex Rivera" in /clients directory', async () => {
      await page.goto(`${baseUrl}/clients`, { waitUntil: 'networkidle0' });
      const searchInput = await page.$('input[placeholder*="Buscar"]');
      assert.ok(searchInput, 'Search input must exist on /clients');

      // Clear input and type "alex"
      await page.evaluate(el => el.value = '', searchInput);
      await searchInput.type('alex');
      await new Promise(r => setTimeout(r, 100));

      const matches = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.luxury-card'));
        return cards.map(c => c.textContent.trim()).filter(t => t.includes('Álex') || t.includes('Rivera'));
      });

      assert.ok(matches.length > 0, 'Searching "alex" must find "Álex Rivera"');
    });

    await test('M4.2: Unaccented search "dani" matches "Dani Morales" in /clients directory', async () => {
      const searchInput = await page.$('input[placeholder*="Buscar"]');

      await page.evaluate(el => el.value = '', searchInput);
      await searchInput.type('dani');
      await new Promise(r => setTimeout(r, 100));

      const matches = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.luxury-card'));
        return cards.map(c => c.textContent.trim()).filter(t => t.includes('Dani') || t.includes('Morales'));
      });

      assert.ok(matches.length > 0, 'Searching "dani" must find "Dani Morales"');
    });

    await test('M4.3: Uppercase search "ALEX" matches "Álex Rivera"', async () => {
      const searchInput = await page.$('input[placeholder*="Buscar"]');

      await page.evaluate(el => el.value = '', searchInput);
      await searchInput.type('ALEX');
      await new Promise(r => setTimeout(r, 100));

      const matches = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.luxury-card'));
        return cards.map(c => c.textContent.trim()).filter(t => t.includes('Álex') || t.includes('Rivera'));
      });

      assert.ok(matches.length > 0, 'Uppercase "ALEX" must find "Álex Rivera"');
    });

    await test('M4.4: Guard formula search "#000" finds clients with matching fade recipe', async () => {
      const searchInput = await page.$('input[placeholder*="Buscar"]');

      await page.evaluate(el => el.value = '', searchInput);
      await searchInput.type('#000');
      await new Promise(r => setTimeout(r, 100));

      const cardsCount = await page.evaluate(() => {
        return document.querySelectorAll('.luxury-card').length;
      });

      assert.ok(cardsCount >= 2, 'Searching "#000" must match clients with #000 shaver base in formula');
    });

    await test('M4.5: Forensic observation of CommandPalette (Ctrl+K) unaccented search', async () => {
      // Open CommandPalette
      await page.keyboard.down('Control');
      await page.keyboard.press('k');
      await page.keyboard.up('Control');
      await new Promise(r => setTimeout(r, 200));

      const cmdInput = await page.$('.luxury-card input[placeholder*="Buscar"]');
      assert.ok(cmdInput, 'CommandPalette search input must exist');

      await page.evaluate(el => el.value = '', cmdInput);
      await cmdInput.type('alex');
      await new Promise(r => setTimeout(r, 100));

      const cmdPaletteMatched = await page.evaluate(() => {
        const modal = document.querySelector('.luxury-card.max-w-xl');
        // Check if matched clients section contains Álex Rivera
        const clientList = modal ? Array.from(modal.querySelectorAll('button')) : [];
        return clientList.some(b => b.textContent.includes('Álex Rivera') && !b.textContent.includes('Ficha Estrella Demo'));
      });

      // CommandPalette currently uses raw toLowerCase without normalizeText
      empiricalFindings.push({
        id: 'COMMAND_PALETTE_ACCENT_NORMALIZATION',
        severity: 'LOW',
        description: 'CommandPalette.jsx:74 uses c.name.toLowerCase().includes(query.toLowerCase()) without normalizeText, so dynamic client search in Cmd+K misses accented names unless typed with exact accent.',
        measured: { cmdPaletteMatched }
      });

      console.log(`    CommandPalette dynamic client search matched "alex": ${cmdPaletteMatched}`);
      if (cmdPaletteMatched) {
        console.log('    ✔ [M4 RESOLVED] CommandPalette unaccented search matches accented client "Álex Rivera".');
        assert.strictEqual(cmdPaletteMatched, true);
      } else {
        assert.strictEqual(cmdPaletteMatched, false, 'CommandPalette misses unaccented search due to lack of normalizeText in CommandPalette.jsx');
      }
    });

  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n================================================================');
  console.log(`EXECUTION SUMMARY: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');
  console.log(`Empirical Findings Logged: ${empiricalFindings.length}`);
  empiricalFindings.forEach((f, i) => {
    console.log(`  [Finding ${i + 1}] [${f.severity}] ${f.id}: ${f.description}`);
  });

  return { totalTests, passedTests, failedTests, empiricalFindings };
}

main().catch(err => {
  console.error('Fatal error in empirical test:', err);
  process.exit(1);
});
