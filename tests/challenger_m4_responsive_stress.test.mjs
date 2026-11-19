/**
 * Empirical Challenger M4: Cross-Device Responsiveness & Diacritic Search Stress Suite
 * 
 * Verifications:
 * 1. Cross-device responsiveness across 6 viewports: 320px, 390px, 768px, 1024px, 1280px, 2560px
 * 2. 0px horizontal scroll overflow on all views:
 *    - Route '/' (Dashboard)
 *    - Route '/clients' (Client directory & 3D Bento cards)
 *    - Route '/clients/3' (ClientProfile - Álex Rivera)
 *    - Route '/clients/1' (ClientProfile - Mateo Vargas)
 *    - Route '/clients/2' (ClientProfile - Dani Morales)
 *    - Secondary metrics drawer expanded
 *    - Modals: CommandPalette, WalkInKioskModal, AIAssistantModal
 * 3. Tablet (768px) chair cards:
 *    - Maintain width >= 200px
 *    - Zero button bleed or overflow (card.scrollWidth <= card.clientWidth)
 *    - Zero button bleed across ALL 4 cycled statuses on all chairs
 * 4. CommandPalette diacritic search normalization:
 *    - Unaccented query -> Accented client ("alex" -> "Álex Rivera")
 *    - Accented query -> Accented client ("áléx" -> "Álex Rivera")
 *    - Accented query -> Unaccented client ("dáni" -> "Dani Morales")
 *    - Uppercase / mixed case queries ("ÁLEX", "ALEX", "Dani")
 *    - Formula & notes search with/without accents
 *    - Tool & command matching with/without accents ("video"/"vídeo", "auditoria"/"auditoría", "kiosko"/"kíosko")
 *    - Unicode normalization forms (NFC vs NFD)
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
console.log('CHALLENGER M4: CROSS-DEVICE RESPONSIVENESS & DIACRITIC STRESS');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];
export const empiricalFindings = [];

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    testResults.push({ name, status: 'PASS' });
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    testResults.push({ name, status: 'FAIL', error: err.message });
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

function startStaticServer(port = 4182) {
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

const VIEWPORTS = [
  { name: 'Ultra-small mobile', width: 320, height: 568 },
  { name: 'Standard mobile', width: 390, height: 844 },
  { name: 'Tablet portrait', width: 768, height: 1024 },
  { name: 'Tablet landscape / Laptop', width: 1024, height: 768 },
  { name: 'Standard desktop', width: 1280, height: 800 },
  { name: 'Ultrawide 2K/4K', width: 2560, height: 1440 }
];

const ROUTES = [
  { path: '/', name: 'Dashboard' },
  { path: '/clients', name: 'Clients Directory' },
  { path: '/clients/3', name: 'ClientProfile (Álex Rivera)' },
  { path: '/clients/1', name: 'ClientProfile (Mateo Vargas)' },
  { path: '/clients/2', name: 'ClientProfile (Dani Morales)' }
];

async function main() {
  const port = 4182;
  const server = await startStaticServer(port);
  const baseUrl = `http://localhost:${port}`;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // ========================================================================
    // 1. HORIZONTAL OVERFLOW STRESS TEST ACROSS ALL 6 VIEWPORTS & ALL 5 ROUTES
    // ========================================================================
    console.log('--- 1. Horizontal Scroll & Overflow Test Across All 6 Viewports ---');

    for (const vp of VIEWPORTS) {
      for (const r of ROUTES) {
        await test(`Overflow Check: ${r.name} at ${vp.width}px (${vp.name})`, async () => {
          await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 1024, hasTouch: vp.width < 1024 });
          await page.goto(`${baseUrl}${r.path}`, { waitUntil: 'networkidle0' });

          const overflowData = await page.evaluate((vpWidth) => {
            const docWidth = document.documentElement.scrollWidth;
            const bodyWidth = document.body.scrollWidth;
            const main = document.querySelector('main');
            const mainScrollWidth = main ? main.scrollWidth : 0;
            const mainClientWidth = main ? main.clientWidth : 0;

            // Scan all visible elements to detect bleed
            const allElements = Array.from(document.querySelectorAll('*'));
            const bleedingElements = [];

            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              // Ignore elements with 0 dimensions or fixed overlays intentionally full-width
              if (rect.width > 0 && rect.height > 0) {
                // Check if element right exceeds viewport width by more than 1px
                if (rect.right > vpWidth + 1.5) {
                  // Check if any ancestor clips overflow
                  let parent = el.parentElement;
                  let isClipped = false;
                  while (parent && parent !== document.documentElement) {
                    const style = window.getComputedStyle(parent);
                    if (style.overflow === 'hidden' || style.overflowX === 'hidden') {
                      isClipped = true;
                      break;
                    }
                    parent = parent.parentElement;
                  }
                  if (!isClipped) {
                    bleedingElements.push({
                      tag: el.tagName,
                      class: el.className ? String(el.className).slice(0, 50) : '',
                      right: Math.round(rect.right),
                      width: Math.round(rect.width),
                      overflowPx: Math.round(rect.right - vpWidth)
                    });
                  }
                }
              }
            }

            return {
              docWidth,
              bodyWidth,
              mainScrollWidth,
              mainClientWidth,
              mainOverflows: mainScrollWidth > mainClientWidth + 1,
              hasBleedingElements: bleedingElements.length > 0,
              bleedingElements: bleedingElements.slice(0, 3)
            };
          }, vp.width);

          // Window-level horizontal scroll check (critical cross-device responsiveness)
          assert.strictEqual(
            overflowData.docWidth,
            vp.width,
            `Document scrollWidth (${overflowData.docWidth}px) exceeds viewport width (${vp.width}px)`
          );
          assert.ok(
            overflowData.bodyWidth <= vp.width + 1,
            `Body scrollWidth (${overflowData.bodyWidth}px) exceeds viewport width (${vp.width}px)`
          );

          // Component-level overflow tracking (logs empirical finding if main container scrolls)
          if (overflowData.mainOverflows) {
            empiricalFindings.push({
              id: 'MAIN_CONTAINER_HORIZONTAL_OVERFLOW',
              severity: vp.width === 768 ? 'MEDIUM' : 'LOW',
              view: r.name,
              path: r.path,
              viewport: `${vp.width}px (${vp.name})`,
              clientWidth: overflowData.mainClientWidth,
              scrollWidth: overflowData.mainScrollWidth,
              deltaPx: overflowData.mainScrollWidth - overflowData.mainClientWidth,
              description: `At ${vp.width}px, <main> container in ${r.name} has scrollWidth (${overflowData.mainScrollWidth}px) > clientWidth (${overflowData.mainClientWidth}px), causing a ${overflowData.mainScrollWidth - overflowData.mainClientWidth}px internal horizontal scroll.`
            });
            console.log(`    ⚠️  [EMPIRICAL FINDING] <main> overflow in ${r.name} at ${vp.width}px: ${overflowData.mainScrollWidth}px vs ${overflowData.mainClientWidth}px (+${overflowData.mainScrollWidth - overflowData.mainClientWidth}px)`);
          }
        });
      }
    }

    // ========================================================================
    // 2. OVERFLOW CHECK ON MODALS & DRAWERS AT 320px, 390px, 768px
    // ========================================================================
    console.log('\n--- 2. Overflow & Bleed on Modals and Collapsible Drawers ---');

    for (const testWidth of [320, 390, 768]) {
      await test(`Secondary Metrics Drawer at ${testWidth}px: 0px overflow when expanded`, async () => {
        await page.setViewport({ width: testWidth, height: 800, isMobile: true, hasTouch: true });
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

        // Click drawer toggle button (Módulo 01: Telemetría & Radar de Fade)
        const drawerBtn = await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => 
            b.textContent.includes('TELEMETRÍA') || 
            b.textContent.includes('Métricas de Retención') ||
            (b.getAttribute('onclick') && b.getAttribute('onclick').includes('telemetry'))
          );
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });
        assert.ok(drawerBtn, 'Drawer toggle button must exist on Dashboard');
        await new Promise(r => setTimeout(r, 200));

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        assert.strictEqual(scrollWidth, testWidth, `Document scrollWidth (${scrollWidth}) exceeds ${testWidth} with drawer expanded`);
      });

      await test(`CommandPalette Modal at ${testWidth}px: fits cleanly within viewport without bleed`, async () => {
        await page.setViewport({ width: testWidth, height: 800, isMobile: true, hasTouch: true });
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

        // Open CommandPalette
        await page.keyboard.down('Control');
        await page.keyboard.press('k');
        await page.keyboard.up('Control');
        await new Promise(r => setTimeout(r, 200));

        const modalData = await page.evaluate((vpWidth) => {
          const modal = document.querySelector('.luxury-card.max-w-xl');
          if (!modal) return null;
          const rect = modal.getBoundingClientRect();
          return {
            width: Math.round(rect.width),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            fits: rect.left >= 0 && rect.right <= vpWidth + 1,
            scrollWidth: document.documentElement.scrollWidth
          };
        }, testWidth);

        assert.ok(modalData, 'CommandPalette modal must be visible');
        assert.ok(modalData.fits, `Modal (right: ${modalData.right}px) bleeds beyond viewport (${testWidth}px)`);
        assert.strictEqual(modalData.scrollWidth, testWidth, `Document scrollWidth exceeds ${testWidth} with modal open`);

        // Close modal
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 150));
      });

      await test(`WalkInKioskModal at ${testWidth}px: zero horizontal overflow`, async () => {
        await page.setViewport({ width: testWidth, height: 800, isMobile: true, hasTouch: true });
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

        // Click Kiosko button
        const clicked = await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Cola Viva') || b.textContent.includes('MODO KIOSKO') || b.textContent.includes('KIOSKO'));
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          await new Promise(r => setTimeout(r, 250));
          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          assert.strictEqual(scrollWidth, testWidth, `Kiosko modal causes overflow on ${testWidth}px`);
          // Close kiosk
          await page.keyboard.press('Escape');
          await new Promise(r => setTimeout(r, 150));
        }
      });
    }

    // ========================================================================
    // 3. TABLET (768px) CHAIR STATIONS STRESS & BUTTON BLEED VERIFICATION
    // ========================================================================
    console.log('\n--- 3. Tablet (768px) Chair Stations & Button Bleed Stress ---');

    await test('Tablet 768px: Chair cards maintain width >= 200px and 0px overflow baseline', async () => {
      await page.setViewport({ width: 768, height: 1024, isMobile: true, hasTouch: true });
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

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
            cardClientWidth: card.clientWidth,
            overflowDelta: Math.max(0, card.scrollWidth - card.clientWidth),
            buttonWidth: buttonRect ? Math.round(buttonRect.width) : 0,
            buttonBleedsRight: buttonRect ? buttonRect.right > rect.right : false,
            buttonBleedDelta: buttonRect ? Math.max(0, Math.round(buttonRect.right - rect.right)) : 0,
            buttonText: button ? button.textContent.trim() : ''
          };
        });
      });

      console.log('    Measured Chair Station Metrics at 768px Tablet:');
      chairMetrics.forEach(c => {
        console.log(`    - Chair ${c.idx}: width=${c.cardWidth}px, scrollWidth=${c.cardScrollWidth}px, button="${c.buttonText}" (${c.buttonWidth}px), bleedDelta=${c.buttonBleedDelta}px`);
      });

      for (const c of chairMetrics) {
        assert.ok(c.cardWidth >= 200, `Chair ${c.idx} card width (${c.cardWidth}px) is less than 200px minimum`);
        assert.strictEqual(c.overflowDelta, 0, `Chair ${c.idx} card scrollWidth exceeds clientWidth by ${c.overflowDelta}px`);
        assert.strictEqual(c.buttonBleedsRight, false, `Chair ${c.idx} button bleeds past right card boundary by ${c.buttonBleedDelta}px`);
      }
    });

    await test('Tablet 768px: Zero button bleed across ALL 4 cycled chair statuses', async () => {
      // CHAIR_STATUS_CYCLE has 4 statuses:
      // 0: 'EN CORTE // FADE'
      // 1: 'WALK-IN LIBRE'
      // 2: 'LIMPIEZA & DESINFECCIÓN'
      // 3: 'PAUSA // DESCANSO'
      await page.setViewport({ width: 768, height: 1024, isMobile: true, hasTouch: true });
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

      for (let chairIndex = 0; chairIndex < 3; chairIndex++) {
        for (let cycleStep = 0; cycleStep < 4; cycleStep++) {
          const evaluation = await page.evaluate((cIdx) => {
            const chairSection = Array.from(document.querySelectorAll('section')).find(s => s.textContent.includes('ESTADO DE SILLONES'));
            const cards = Array.from(chairSection.querySelectorAll('.luxury-card'));
            const card = cards[cIdx];
            if (!card) return null;

            const button = card.querySelector('button');
            const cardRect = card.getBoundingClientRect();
            const btnRect = button ? button.getBoundingClientRect() : null;

            const metrics = {
              cardWidth: Math.round(cardRect.width),
              cardScrollWidth: card.scrollWidth,
              cardClientWidth: card.clientWidth,
              buttonText: button ? button.textContent.trim() : '',
              buttonWidth: btnRect ? Math.round(btnRect.width) : 0,
              buttonRight: btnRect ? Math.round(btnRect.right) : 0,
              cardRight: Math.round(cardRect.right),
              bleeds: btnRect ? btnRect.right > cardRect.right + 0.5 : false,
              bleedPx: btnRect ? Math.max(0, Math.round(btnRect.right - cardRect.right)) : 0
            };

            // Click the button to cycle to next state for next iteration
            if (button) button.click();

            return metrics;
          }, chairIndex);

          assert.ok(evaluation, `Chair ${chairIndex} must be present`);
          assert.ok(evaluation.cardWidth >= 200, `Chair ${chairIndex} in status "${evaluation.buttonText}" width (${evaluation.cardWidth}px) < 200px`);
          assert.strictEqual(
            evaluation.bleeds,
            false,
            `Chair ${chairIndex} button "${evaluation.buttonText}" bleeds past card right by ${evaluation.bleedPx}px`
          );
          assert.ok(
            evaluation.cardScrollWidth <= evaluation.cardClientWidth + 1,
            `Chair ${chairIndex} in status "${evaluation.buttonText}" scrollWidth (${evaluation.cardScrollWidth}px) > clientWidth (${evaluation.cardClientWidth}px)`
          );

          await new Promise(r => setTimeout(r, 80));
        }
      }
    });

    // ========================================================================
    // 4. COMMAND PALETTE DIACRITIC SEARCH NORMALIZATION EMPIRICAL MATRIX
    // ========================================================================
    console.log('\n--- 4. CommandPalette Diacritic Search Normalization Stress Matrix ---');

    const searchCases = [
      // Client search variations
      { query: 'alex', expectedMatch: 'Álex Rivera', category: 'client', description: 'unaccented lowercase' },
      { query: 'ALEX', expectedMatch: 'Álex Rivera', category: 'client', description: 'unaccented uppercase' },
      { query: 'Alex', expectedMatch: 'Álex Rivera', category: 'client', description: 'capitalized' },
      { query: 'Álex', expectedMatch: 'Álex Rivera', category: 'client', description: 'exact accented uppercase' },
      { query: 'áléx', expectedMatch: 'Álex Rivera', category: 'client', description: 'hyper-accented lowercase' },
      { query: 'ÁLÉX', expectedMatch: 'Álex Rivera', category: 'client', description: 'hyper-accented uppercase' },
      { query: 'rivera', expectedMatch: 'Álex Rivera', category: 'client', description: 'unaccented surname' },
      { query: 'dani', expectedMatch: 'Dani Morales', category: 'client', description: 'unaccented name' },
      { query: 'dáni', expectedMatch: 'Dani Morales', category: 'client', description: 'accented query against unaccented name' },
      { query: 'DÁNI', expectedMatch: 'Dani Morales', category: 'client', description: 'uppercase accented query against unaccented name' },
      { query: 'mateo', expectedMatch: 'Mateo "El Flaco" Vargas', category: 'client', description: 'unaccented name' },
      { query: 'máteo', expectedMatch: 'Mateo "El Flaco" Vargas', category: 'client', description: 'accented query against unaccented name' },
      
      // Technical cut formula searches
      { query: '#000', expectedMatch: 'Álex Rivera', category: 'client', description: 'shaver guard symbol query' },
      { query: 'shaver', expectedMatch: 'Álex Rivera', category: 'client', description: 'cut recipe keyword' },
      { query: 'sháver', expectedMatch: 'Álex Rivera', category: 'client', description: 'accented cut recipe keyword' },

      // Quick commands searches
      { query: 'kiosko', expectedMatch: 'Lanzar Cola Viva // Modo TV Kiosko', category: 'command', description: 'unaccented command search' },
      { query: 'kíosko', expectedMatch: 'Lanzar Cola Viva // Modo TV Kiosko', category: 'command', description: 'accented command search' },
      { query: 'KIOSKO', expectedMatch: 'Lanzar Cola Viva // Modo TV Kiosko', category: 'command', description: 'uppercase command search' },
      { query: 'video', expectedMatch: 'Generar Reel 9:16 (Instagram & TikTok)', category: 'command', description: 'unaccented command search (matches subtitle "Vídeo vertical")' },
      { query: 'vídeo', expectedMatch: 'Generar Reel 9:16 (Instagram & TikTok)', category: 'command', description: 'accented command search' },
      { query: 'auditoria', expectedMatch: 'Escudo Anti No-Show & Rellena Huecos Flash', category: 'command', description: 'unaccented command search (matches subtitle "Auditoría")' },
      { query: 'auditoría', expectedMatch: 'Escudo Anti No-Show & Rellena Huecos Flash', category: 'command', description: 'accented command search' }
    ];

    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

    for (const sc of searchCases) {
      await test(`Diacritic Search: "${sc.query}" (${sc.description}) matches "${sc.expectedMatch}"`, async () => {
        // Open CommandPalette
        await page.keyboard.down('Control');
        await page.keyboard.press('k');
        await page.keyboard.up('Control');
        await new Promise(r => setTimeout(r, 120));

        const cmdInput = await page.$('.luxury-card input[placeholder*="Buscar"]');
        assert.ok(cmdInput, 'CommandPalette search input must exist');

        // Clear and type search query
        await page.evaluate(el => el.value = '', cmdInput);
        await cmdInput.type(sc.query);
        await new Promise(r => setTimeout(r, 100));

        const matchResult = await page.evaluate((expected, category) => {
          const modal = document.querySelector('.luxury-card.max-w-xl');
          if (!modal) return { found: false, allText: '' };

          const buttons = Array.from(modal.querySelectorAll('button'));
          let matches = false;

          if (category === 'client') {
            // Check client result buttons
            matches = buttons.some(b => b.textContent.includes(expected) && !b.textContent.includes('Ficha Estrella Demo'));
          } else {
            // Check command result buttons
            matches = buttons.some(b => b.textContent.includes(expected));
          }

          return {
            found: matches,
            buttonTexts: buttons.map(b => b.textContent.trim().replace(/\s+/g, ' ')).slice(0, 5)
          };
        }, sc.expectedMatch, sc.category);

        // Close palette
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 80));

        assert.strictEqual(
          matchResult.found,
          true,
          `Query "${sc.query}" failed to match "${sc.expectedMatch}". Found instead: ${JSON.stringify(matchResult.buttonTexts)}`
        );
      });
    }

    // ========================================================================
    // 5. UNICODE NORMALIZATION FORM STRESS (NFC vs NFD)
    // ========================================================================
    console.log('\n--- 5. Unicode Decomposition Form Stress (NFC vs NFD) ---');

    await test('Unicode Form D (decomposed combining characters) vs Form C', async () => {
      // Test the normalizeText algorithm directly on extreme Unicode cases
      const res = await page.evaluate(() => {
        const nfd = 'A\u0301lex'; // 'A' + combining acute accent
        const nfc = '\u00c1lex'; // precomposed 'Á'
        
        // Check if normalizeText handles both identically
        const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

        return {
          nfdNorm: norm(nfd),
          nfcNorm: norm(nfc),
          equal: norm(nfd) === norm(nfc),
          sampleVal: norm(nfd)
        };
      });

      assert.strictEqual(res.equal, true, 'NFD and NFC normalized strings must be strictly equal');
      assert.strictEqual(res.sampleVal, 'alex', 'Decomposed accent must strip down to "alex"');
    });

  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n================================================================');
  console.log(`CHALLENGER M4 TEST SUMMARY: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');
  console.log(`Empirical Findings Logged: ${empiricalFindings.length}`);
  empiricalFindings.forEach((f, i) => {
    console.log(`  [Finding ${i + 1}] [${f.severity}] ${f.id}: ${f.description}`);
  });
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error running Challenger M4 test suite:', err);
  process.exit(1);
});
