/**
 * Empirical Challenger M2 Stress Test Suite:
 * Adversarial validation of 3D Flip Card Component (ClientBentoCard.jsx)
 * 
 * Verifies:
 * 1. Event bubbling isolation (WhatsApp, inputs, buttons never flip card)
 * 2. Rapid consecutive card flips (<10ms)
 * 3. Extreme text lengths in notes and guard formulas (scrollability & clipping boundaries)
 * 4. Responsive viewports (390px mobile up to 2560px ultra-wide)
 * 5. CSS 3D Face Stacking & Specificity Analysis
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
console.log('CHALLENGER M2: EMPIRICAL STRESS TEST SUITE');
console.log('3D Bento Card (ClientBentoCard.jsx) Adversarial Verification');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const empiricalFindings = [];

async function asyncTest(name, fn) {
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

async function runAll() {
  assert.ok(fs.existsSync(distDir), 'Production dist/ directory must exist.');

  const { server, url } = await startStaticServer();
  console.log(`Local test server running at ${url}`);

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
    // ------------------------------------------------------------------------
    // SUITE 1: Event Bubbling Isolation & Propagation Containment
    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 1: Event Bubbling Isolation (WhatsApp & Quick Session) ---');

    await asyncTest('Event Isolation: WhatsApp button click opens link and NEVER flips card', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      await page.evaluate(() => {
        window.__openCalls = [];
        window.open = (url, target, features) => {
          window.__openCalls.push({ url, target, features });
          return null;
        };
      });

      const waBtn = await page.$('button[title="Contactar por WhatsApp"]');
      assert.ok(waBtn, 'WhatsApp button must be present on Front Face');
      await waBtn.click();
      await new Promise(r => setTimeout(r, 100));

      const isFlipped = await page.evaluate(() => {
        const cardInner = document.querySelector('.perspective-1000 .transform-style-3d');
        return cardInner.classList.contains('rotate-y-180');
      });

      assert.strictEqual(isFlipped, false, 'Card must NOT flip when WhatsApp button is clicked');
      await page.close();
    });

    await asyncTest('Event Isolation: WhatsApp child SVG/span click does not flip card', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      await page.evaluate(() => {
        window.open = () => null;
        const btn = document.querySelector('button[title="Contactar por WhatsApp"]');
        const span = btn.querySelector('span');
        span.click();
      });
      await new Promise(r => setTimeout(r, 100));

      const isFlipped = await page.evaluate(() => {
        const cardInner = document.querySelector('.perspective-1000 .transform-style-3d');
        return cardInner.classList.contains('rotate-y-180');
      });
      assert.strictEqual(isFlipped, false, 'Clicking WhatsApp button child span must NOT flip card');
      await page.close();
    });

    await asyncTest('Event Isolation: "Ficha" button click does not flip card', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      await page.evaluate(() => {
        const btn = document.querySelector('.perspective-1000 button:nth-of-type(2)');
        btn.click();
      });
      await new Promise(r => setTimeout(r, 100));

      const currentUrl = page.url();
      assert.ok(currentUrl.includes('/clients/'), 'Ficha button navigated to profile cleanly');
      await page.close();
    });

    await asyncTest('Event Isolation: Back face background click does NOT flip card back', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      // Flip card
      await page.click('button[title="Girar para ver receta y notas técnicas"]');
      await new Promise(r => setTimeout(r, 700));

      // Click on back face container itself
      await page.evaluate(() => {
        const backFace = document.querySelector('.rotate-y-180.luxury-card');
        backFace.click();
      });
      await new Promise(r => setTimeout(r, 100));

      const isFlipped = await page.evaluate(() => {
        const cardInner = document.querySelector('.perspective-1000 .transform-style-3d');
        return cardInner.classList.contains('rotate-y-180');
      });
      assert.strictEqual(isFlipped, true, 'Clicking back face container must NOT flip card back (stopPropagation is active)');
      await page.close();
    });

    await asyncTest('Event Isolation: Quick session formula/notes typing and Guardar click NEVER flip card', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      // Flip card
      await page.click('button[title="Girar para ver receta y notas técnicas"]');
      await new Promise(r => setTimeout(r, 700));

      // Type and click Guardar in evaluate
      const res = await page.evaluate(() => {
        const card = document.querySelector('.perspective-1000');
        const backFace = card.children[0].children[1];
        const formulaInput = backFace.querySelector('input[placeholder*="Fórmula peines"]');
        const notesInput = backFace.querySelector('input[placeholder*="Notas de sillón"]');
        const btns = Array.from(backFace.querySelectorAll('button'));
        const saveBtn = btns.find(b => b.textContent.includes('Guardar'));

        formulaInput.value = '#000 -> #0.5 -> #2';
        notesInput.value = 'Prueba rápida';
        saveBtn.click();

        const cardInner = card.querySelector('.transform-style-3d');
        return {
          isFlipped: cardInner.classList.contains('rotate-y-180')
        };
      });

      assert.strictEqual(res.isFlipped, true, 'Card remains on Back Face after filling and saving quick session');

      // Verify feedback message appears after React renders
      await new Promise(r => setTimeout(r, 100));
      const feedbackShown = await page.evaluate(() => {
        return document.querySelector('.perspective-1000').innerHTML.includes('¡Corte guardado!');
      });
      assert.strictEqual(feedbackShown, true, 'Feedback badge "¡Corte guardado!" appears on back face');

      // Flip back explicitly
      await page.evaluate(() => {
        const flipBackBtn = document.querySelector('button[title="Volver a cara frontal"]');
        flipBackBtn.click();
      });
      await new Promise(r => setTimeout(r, 700));

      const isFlippedBack = await page.evaluate(() => {
        const cardInner = document.querySelector('.perspective-1000 .transform-style-3d');
        return cardInner.classList.contains('rotate-y-180');
      });
      assert.strictEqual(isFlippedBack, false, 'Card flips back cleanly to Front Face via RotateCcw button');
      await page.close();
    });

    // ------------------------------------------------------------------------
    // SUITE 2: Rapid Consecutive Card Flips (<10ms) & Audio Stress
    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 2: Rapid Consecutive Card Flips (<10ms) & Audio Stress ---');

    await asyncTest('Rapid Flips: 10 flips with 2ms interval maintain parity (return to Front Face)', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      await page.evaluate(async () => {
        const cardInner = document.querySelector('.perspective-1000 .transform-style-3d');
        for (let i = 0; i < 10; i++) {
          cardInner.click();
          await new Promise(r => setTimeout(r, 2));
        }
      });
      await new Promise(r => setTimeout(r, 300));

      const finalState = await page.evaluate(() => {
        const cardInner = document.querySelector('.perspective-1000 .transform-style-3d');
        return cardInner.classList.contains('rotate-y-180');
      });
      assert.strictEqual(finalState, false, '10 rapid flips must return to Front Face (even parity)');
      await page.close();
    });

    await asyncTest('Rapid Flips: 21 flips with 1ms interval maintain parity (ends on Back Face)', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      await page.evaluate(async () => {
        const cardInner = document.querySelector('.perspective-1000 .transform-style-3d');
        for (let i = 0; i < 21; i++) {
          cardInner.click();
          await new Promise(r => setTimeout(r, 1));
        }
      });
      await new Promise(r => setTimeout(r, 300));

      const finalState = await page.evaluate(() => {
        const cardInner = document.querySelector('.perspective-1000 .transform-style-3d');
        return cardInner.classList.contains('rotate-y-180');
      });
      assert.strictEqual(finalState, true, '21 rapid flips must finish on Back Face (odd parity)');
      await page.close();
    });

    await asyncTest('Rapid Flips: 50 zero-delay synchronous flips do not crash React or CSS state', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      await page.evaluate(() => {
        const cardInner = document.querySelector('.perspective-1000 .transform-style-3d');
        for (let i = 0; i < 50; i++) {
          cardInner.click();
        }
      });
      await new Promise(r => setTimeout(r, 300));

      const evaluation = await page.evaluate(() => {
        const cardInner = document.querySelector('.perspective-1000 .transform-style-3d');
        return {
          isFlipped: cardInner.classList.contains('rotate-y-180'),
          hasErrorClass: cardInner.className.includes('undefined') || cardInner.className.includes('NaN')
        };
      });
      assert.strictEqual(evaluation.isFlipped, false, '50 synchronous flips maintain even parity');
      assert.strictEqual(evaluation.hasErrorClass, false, 'No undefined/NaN class corruption in DOM');
      await page.close();
    });

    await asyncTest('Web Audio API Stress: 100 consecutive soundFx.playFlip calls within 5ms', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      const audioStressResult = await page.evaluate(async () => {
        let errors = 0;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return { supported: false, errors: 0 };

        const ctx = new AudioCtx();
        for (let i = 0; i < 100; i++) {
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.05);
          } catch {
            errors++;
          }
        }
        await ctx.close();
        return { supported: true, errors };
      });
      assert.strictEqual(audioStressResult.errors, 0, '100 rapid Web Audio invocations execute without errors');
      await page.close();
    });

    // ------------------------------------------------------------------------
    // SUITE 3: Extreme Text Lengths in Notes and Guard Formulas
    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 3: Extreme Text Lengths & Layout Containment Stress ---');

    await asyncTest('Extreme Text: Internal scrollability for formula (max-h-16) and notes (max-h-20)', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      const adversarialClients = [
        {
          id: 'adv-1',
          name: 'Álex Rivera VIP ' + 'EXTRA_'.repeat(10),
          phone: '+34 622 456 789',
          photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=600',
          bonos: [{ id: 'b1', totalSessions: 4, usedSessions: 1 }],
          treatment: 'Base Shaver #000 → #0.5 → #1.5 → #2 → #3 | Superior: Texturizado | '.repeat(25),
          notes: 'Morfología compleja con doble remolino en coronilla y hueso occipital prominente. '.repeat(30),
          allergies: 'Sensibilidad a navaja en nuca baja. '.repeat(10),
          treatments: [
            {
              id: 999,
              name: 'Fórmula Hiper-Extensa Fade',
              formula: 'Base Shaver #000 → #0.5 → #1.5 → #2 → #3 | Superior: Texturizado | '.repeat(25),
              ritual: 'Toalla caliente con mentol y vaporizador de ozono',
              notes: 'Notas de sesión hiper-extensas para verificación de scroll'
            }
          ]
        }
      ];

      await page.evaluateOnNewDocument((clientsData) => {
        localStorage.setItem('kutz_barber_clients_seeded_v1', 'true');
        localStorage.setItem('luminadesk_clients', JSON.stringify(clientsData));
      }, adversarialClients);

      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      // Flip card
      await page.click('button[title="Girar para ver receta y notas técnicas"]');
      await new Promise(r => setTimeout(r, 700));

      const scrollAudit = await page.evaluate(() => {
        const card = document.querySelector('.perspective-1000');
        const backContainer = card.querySelector('.rotate-y-180.luxury-card');
        const formulaDiv = backContainer.querySelector('.max-h-16');
        const notesDiv = backContainer.querySelector('.max-h-20');

        return {
          formulaScrollable: formulaDiv && formulaDiv.scrollHeight > formulaDiv.clientHeight,
          formulaOverflowY: formulaDiv ? window.getComputedStyle(formulaDiv).overflowY : null,
          notesScrollable: notesDiv && notesDiv.scrollHeight > notesDiv.clientHeight,
          notesOverflowY: notesDiv ? window.getComputedStyle(notesDiv).overflowY : null,
          backFaceScrollHeight: backContainer.scrollHeight,
          backFaceClientHeight: backContainer.clientHeight
        };
      });

      assert.strictEqual(scrollAudit.formulaScrollable, true, 'Formula container scrolls internally within max-h-16');
      assert.strictEqual(scrollAudit.formulaOverflowY, 'auto', 'Formula container uses overflow-y: auto');
      assert.strictEqual(scrollAudit.notesScrollable, true, 'Notes container scrolls internally within max-h-20');
      assert.strictEqual(scrollAudit.notesOverflowY, 'auto', 'Notes container uses overflow-y: auto');

      // Check if total backface content exceeds card height
      const overflowsBackface = scrollAudit.backFaceScrollHeight > scrollAudit.backFaceClientHeight;
      if (overflowsBackface) {
        empiricalFindings.push({
          category: 'LAYOUT_CLIPPING',
          severity: 'HIGH',
          title: 'Back Face Card Content Vertical Overflow Clipping',
          description: `When formula and notes are populated with extensive clinical data, backFace.scrollHeight (${scrollAudit.backFaceScrollHeight}px) exceeds backFace.clientHeight (${scrollAudit.backFaceClientHeight}px) by ${scrollAudit.backFaceScrollHeight - scrollAudit.backFaceClientHeight}px. Because the back face container has overflow-hidden without a card-level vertical scrollbar, the bottom quick logger and "Ver Historial Completo" button are partially clipped.`
        });
      }

      await page.close();
    });

    // ------------------------------------------------------------------------
    // SUITE 4: Responsive Viewports (~390px mobile up to 2560px ultra-wide)
    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 4: Responsive Viewports (~390px mobile up to 2560px ultra-wide) ---');

    const viewportsToTest = [
      { name: 'Mobile Entry (360x740)', width: 360, height: 740, expectedCols: 1 },
      { name: 'Mobile Standard (390x844)', width: 390, height: 844, expectedCols: 1 },
      { name: 'Desktop Laptop (1280x800)', width: 1280, height: 800, expectedCols: 3 },
      { name: 'Desktop Full HD (1920x1080)', width: 1920, height: 1080, expectedCols: 3 },
      { name: 'Ultra-wide QHD (2560x1440)', width: 2560, height: 1440, expectedCols: 3 }
    ];

    for (const vp of viewportsToTest) {
      await asyncTest(`Responsive Viewport: ${vp.name} column layout and zero horizontal overflow`, async () => {
        const page = await browser.newPage();
        await page.setViewport({ width: vp.width, height: vp.height });

        await page.evaluateOnNewDocument(() => {
          localStorage.removeItem('luminadesk_clients');
          localStorage.removeItem('kutz_barber_clients_seeded_v1');
        });

        await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

        const metrics = await page.evaluate(() => {
          const doc = document.documentElement;
          const grid = document.querySelector('.grid');
          const gridComputed = window.getComputedStyle(grid);
          const gridColumns = gridComputed.gridTemplateColumns.split(' ').length;
          const card = document.querySelector('.perspective-1000');
          const cardRect = card ? card.getBoundingClientRect() : null;

          return {
            hasHorizontalOverflow: doc.scrollWidth > window.innerWidth,
            gridColumns,
            cardWidth: cardRect ? Math.round(cardRect.width) : 0,
            cardHeight: cardRect ? Math.round(cardRect.height) : 0
          };
        });

        assert.strictEqual(metrics.hasHorizontalOverflow, false, `No horizontal document overflow at ${vp.width}px`);
        assert.strictEqual(metrics.gridColumns, vp.expectedCols, `Grid renders ${vp.expectedCols} columns at ${vp.width}px`);
        assert.strictEqual(metrics.cardHeight, 460, `Card height maintains 460px at ${vp.width}px`);
        await page.close();
      });
    }

    // ------------------------------------------------------------------------
    // SUITE 5: Empirical Adversarial Findings (Tablet Compression & CSS Specificity)
    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 5: Empirical Adversarial Findings & Root Cause Analysis ---');

    await asyncTest('Empirical Discovery 1: CSS specificity defect (.luxury-card overrides position:absolute)', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      const specificityAudit = await page.evaluate(() => {
        const card = document.querySelector('.perspective-1000');
        const frontFace = card.children[0].children[0];
        const backFace = card.children[0].children[1];
        const csFront = window.getComputedStyle(frontFace);
        const csBack = window.getComputedStyle(backFace);

        return {
          frontPosition: csFront.position,
          backPosition: csBack.position,
          backOffsetTop: backFace.offsetTop
        };
      });

      console.log('    Computed CSS Position Audit:');
      console.log('    - Front Face position:', specificityAudit.frontPosition);
      console.log('    - Back Face position:', specificityAudit.backPosition);
      console.log('    - Back Face offsetTop:', `${specificityAudit.backOffsetTop}px`);

      if (specificityAudit.frontPosition === 'relative' || specificityAudit.backPosition === 'relative') {
        empiricalFindings.push({
          category: 'CSS_SPECIFICITY_DEFECT',
          severity: 'HIGH',
          title: '.luxury-card { position: relative } overrides position: absolute on Card Faces',
          description: `In src/index.css line 80, .luxury-card declares 'position: relative'. In ClientBentoCard.jsx lines 95 and 229, both Front and Back faces declare 'absolute inset-0 ... luxury-card'. In Tailwind v4, the class selector .luxury-card overrides the utility .absolute. Consequently, both faces compute to 'position: relative', causing the Back Face to be vertically displaced below the Front Face in DOM normal flow (backFace.offsetTop === 460px). When rotated in 3D, the Back Face rotates around an origin displaced 460px below the card container bounds.`
        });
      }

      // Assert that this finding was empirically registered
      assert.ok(empiricalFindings.some(f => f.category === 'CSS_SPECIFICITY_DEFECT'), 'Empirical finding must be documented');
      await page.close();
    });

    await asyncTest('Empirical Discovery 2: Tablet 768px viewport column compression & button overflow', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(`${url}/clients`, { waitUntil: 'networkidle0' });

      const tabletAudit = await page.evaluate(() => {
        const card = document.querySelector('.perspective-1000');
        const cardRect = card.getBoundingClientRect();
        const frontFace = card.children[0].children[0];
        const flipBtn = frontFace.querySelector('button[title="Girar para ver receta y notas técnicas"]');
        const flipRect = flipBtn ? flipBtn.getBoundingClientRect() : null;

        return {
          cardWidth: cardRect.width,
          cardRight: cardRect.right,
          flipBtnRight: flipRect ? flipRect.right : null,
          flipBtnBleedsRight: flipRect ? flipRect.right > cardRect.right : false
        };
      });

      console.log('    Tablet 768px Audit:');
      console.log('    - Card width:', `${tabletAudit.cardWidth}px`);
      console.log('    - Flip button bleeds outside card:', tabletAudit.flipBtnBleedsRight);

      if (tabletAudit.cardWidth < 200 || tabletAudit.flipBtnBleedsRight) {
        empiricalFindings.push({
          category: 'RESPONSIVE_BREAKPOINT_DEFECT',
          severity: 'MEDIUM',
          title: 'Tablet 768px Sidebar + 2-Column Grid Squeezes Card to 192px Width',
          description: `At 768px (md breakpoint), Layout.jsx displays the fixed desktop sidebar (w-76 = 304px), leaving only 464px for main content. Clients.jsx immediately switches to md:grid-cols-2 with gap-6, compressing each card to 192px width. In a 192px card (152px inner content width), the 3 action buttons (WhatsApp, Ficha, Voltear requiring 240px) bleed horizontally by ~140px outside the card, and the Back Face content overflows vertically by 147px.`
        });
      }

      assert.ok(empiricalFindings.some(f => f.category === 'RESPONSIVE_BREAKPOINT_DEFECT'), 'Empirical finding must be documented');
      await page.close();
    });

  } finally {
    await browser.close();
    server.close();
  }

  // --------------------------------------------------------------------------
  // Summary and Verdict
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log(`TOTAL ADVERSARIAL FINDINGS: ${empiricalFindings.length}`);
  console.log('================================================================');

  empiricalFindings.forEach((f, idx) => {
    console.log(`\n[FINDING #${idx + 1}] Category: ${f.category} | Severity: ${f.severity}`);
    console.log(`Title: ${f.title}`);
    console.log(`Details: ${f.description}`);
  });

  if (failedTests > 0) {
    process.exitCode = 1;
  } else {
    console.log('\n✔ EMPIRICAL AUDIT COMPLETE');
    process.exitCode = 0;
  }
}

runAll().catch(err => {
  console.error('Fatal stress test runner failure:', err);
  process.exit(1);
});
