import assert from 'node:assert';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import bookingHandler from '../netlify/functions/booking.js';
import syncHandler from '../netlify/functions/sync.js';
import adminHandler from '../netlify/functions/admin.js';
import { resetMemoryStore, getShopConfig } from '../netlify/functions/lib/blobsClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');

function startFullStackServer(port = 4195) {
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

    const server = http.createServer(async (req, res) => {
      const fullUrl = `http://localhost:${port}${req.url}`;

      // Route /api/* directly to real Netlify Function v2 handlers
      if (req.url.startsWith('/api/')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const bodyBuffer = Buffer.concat(chunks);

        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) {
          if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
        }

        const webReq = new Request(fullUrl, {
          method: req.method,
          headers,
          body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : bodyBuffer
        });

        let webRes;
        if (req.url.startsWith('/api/admin/')) {
          webRes = await adminHandler(webReq, {});
        } else if (req.url.includes('/sync')) {
          webRes = await syncHandler(webReq, {});
        } else {
          webRes = await bookingHandler(webReq, {});
        }

        res.statusCode = webRes.status;
        webRes.headers.forEach((val, key) => res.setHeader(key, val));
        const respText = await webRes.text();
        res.end(respText);
        return;
      }

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

async function runVerification() {
  resetMemoryStore();
  await getShopConfig('kutz-madrid');
  await getShopConfig('joseh-barber');

  const port = 4195;
  const server = await startFullStackServer(port);
  const baseUrl = `http://localhost:${port}`;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // =========================================================================
    // 1. VERIFY PUBLIC PORTAL /r/joseh-barber: ZERO /sync CALLS & ZERO LEAKS
    // =========================================================================
    console.log('1. Testing Public Portal /r/joseh-barber isolation & UX on 375x812...');
    const pubPage = await browser.newPage();
    await pubPage.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

    const syncRequests = [];
    pubPage.on('request', (req) => {
      if (req.url().includes('/sync')) {
        syncRequests.push(req.url());
      }
    });

    await pubPage.goto(`${baseUrl}/r/joseh-barber`, { waitUntil: 'networkidle0' });

    assert.strictEqual(syncRequests.length, 0, `Expected 0 /sync requests on /r/joseh-barber, got ${syncRequests.length}`);

    const storageDump = await pubPage.evaluate(() => {
      const dump = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        dump[k] = localStorage.getItem(k);
      }
      return JSON.stringify(dump);
    });
    assert.strictEqual(storageDump.includes('"2023"'), false, 'Public localStorage must never contain barber PIN 2023');

    // Test "Soy el Barbero" modal has Cancel/Salir and NO Demo button
    await pubPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Soy el Barbero'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 200));

    const modalCheck = await pubPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim());
      return {
        hasDemo: buttons.some((t) => t === 'Demo' || t.includes('Demo')),
        hasCancel: buttons.some((t) => t.includes('Salir') || t.includes('Cancelar'))
      };
    });
    assert.strictEqual(modalCheck.hasDemo, false, 'BarberPinLockModal must NOT have a Demo bypass button');
    assert.strictEqual(modalCheck.hasCancel, true, 'BarberPinLockModal must have a Cancelar/Salir button');

    // Click Cancelar to return cleanly to booking page
    await pubPage.evaluate(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent.includes('Cancelar') || b.textContent.includes('Salir')
      );
      if (cancelBtn) cancelBtn.click();
    });
    await new Promise((r) => setTimeout(r, 150));
    await pubPage.close();
    console.log('   ✔ PASS: /r/joseh-barber makes 0 /sync calls, leaks 0 PIN/clients, and allows canceling PIN modal.');

    // =========================================================================
    // 2. VERIFY MOBILE HEADER & BENTO CARD ("Ver corte") AT 375x812 AND 390x844
    // =========================================================================
    for (const vp of [
      { width: 375, height: 812 },
      { width: 390, height: 844 }
    ]) {
      console.log(`2. Testing Mobile Header & Bento Card layout at ${vp.width}x${vp.height}...`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });

      // Dashboard header test
      await page.goto(`${baseUrl}/?shop=kutz-madrid`, { waitUntil: 'networkidle0' });
      const headerMetrics = await page.evaluate((vw) => {
        const header = document.querySelector('header');
        const buttons = Array.from(header.querySelectorAll('button')).filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const clippedButtons = buttons
          .map((b) => {
            const r = b.getBoundingClientRect();
            return { text: b.textContent.trim() || b.getAttribute('aria-label'), right: Math.round(r.right), left: Math.round(r.left) };
          })
          .filter((b) => b.right > vw || b.left < 0);
        const hasAdminBtn = buttons.some((b) => b.textContent.includes('Admin'));
        return {
          docScrollWidth: document.documentElement.scrollWidth,
          headerScrollWidth: header.scrollWidth,
          headerClientWidth: header.clientWidth,
          clippedButtons,
          hasAdminBtn
        };
      }, vp.width);

      assert.strictEqual(headerMetrics.docScrollWidth <= vp.width, true, `Doc scrollWidth ${headerMetrics.docScrollWidth} > ${vp.width}`);
      assert.strictEqual(
        headerMetrics.headerScrollWidth <= headerMetrics.headerClientWidth,
        true,
        `Header overflow: scrollWidth ${headerMetrics.headerScrollWidth} > clientWidth ${headerMetrics.headerClientWidth}`
      );
      assert.strictEqual(
        headerMetrics.clippedButtons.length,
        0,
        `Clipped header buttons at ${vp.width}px: ${JSON.stringify(headerMetrics.clippedButtons)}`
      );
      assert.strictEqual(headerMetrics.hasAdminBtn, false, 'Top header must not expose Admin button to barbers');

      // Clients 3D Bento Card "Ver corte" test
      await page.goto(`${baseUrl}/clients?shop=kutz-madrid`, { waitUntil: 'networkidle0' });
      const bentoMetrics = await page.evaluate((vw) => {
        const verCorteBtns = Array.from(document.querySelectorAll('button')).filter((b) =>
          b.textContent.includes('Ver corte')
        );
        return verCorteBtns.map((b) => {
          const r = b.getBoundingClientRect();
          return {
            text: b.textContent.trim(),
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            height: Math.round(r.height),
            clipped: r.right > vw || r.left < 0
          };
        });
      }, vp.width);

      assert.ok(bentoMetrics.length > 0, 'Must find "Ver corte" buttons on /clients');
      const clippedBento = bentoMetrics.filter((b) => b.clipped);
      assert.strictEqual(
        clippedBento.length,
        0,
        `"Ver corte" button clipped at ${vp.width}px: ${JSON.stringify(bentoMetrics)}`
      );

      await page.close();
      console.log(`   ✔ PASS: ${vp.width}x${vp.height} has 0px header overflow and 0 clipped "Ver corte" buttons (right=${bentoMetrics[0].right}px <= ${vp.width}px).`);
    }

    // =========================================================================
    // 3. VERIFY JOSEH-BARBER DASHBOARD & TACTILE AGENDA AT 390x844
    // =========================================================================
    console.log('3. Testing José Barber Hub (/?shop=joseh-barber) & Tactile Agenda Modal at 390x844...');
    const josePage = await browser.newPage();
    await josePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await josePage.goto(`${baseUrl}/?shop=joseh-barber&pin=2023`, { waitUntil: 'networkidle0' });

    const joseDashboardState = await josePage.evaluate(() => {
      const rawText = document.body.textContent || '';
      return {
        hasJoseChair: rawText.includes('José (Joseh_barber.style)'),
        hasFakeRexChair: rawText.includes('KIKO') || rawText.includes('NICO'),
        hasZeroCashier: rawText.includes('Caja Hoy: 0€'),
        hasScheduleBtn: Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Horario apertura'))
      };
    });

    assert.strictEqual(joseDashboardState.hasJoseChair, true, 'Dashboard for joseh-barber must display José in Sillón 1');
    assert.strictEqual(joseDashboardState.hasFakeRexChair, false, 'Dashboard for joseh-barber must NOT display REX/KIKO/NICO');
    assert.strictEqual(joseDashboardState.hasZeroCashier, true, 'Dashboard for joseh-barber must start at 0€ instead of fake 126€');
    assert.strictEqual(joseDashboardState.hasScheduleBtn, true, 'Dashboard must include Horario apertura editor button');

    // Tap late afternoon slot 19:00 on VisualAgendaTimeline and verify modal opens centered in viewport (not off-screen top: -188px)
    await josePage.evaluate(() => {
      const slot19 = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === '19:00');
      if (slot19 && slot19.parentElement && slot19.parentElement.parentElement) {
        slot19.parentElement.parentElement.click();
      }
    });
    await new Promise((r) => setTimeout(r, 200));

    const agendaModalMetrics = await josePage.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('span')).find((s) =>
        s.textContent.includes('Añadir Cita o Bloqueo en Agenda')
      );
      if (!heading) return null;
      const dialog = heading.closest('.max-w-lg');
      const r = dialog.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        visibleInViewport: r.top >= 0 && r.bottom <= window.innerHeight
      };
    });

    assert.ok(agendaModalMetrics, 'Tapping 19:00 must open the tactile agenda modal');
    assert.strictEqual(
      agendaModalMetrics.visibleInViewport,
      true,
      `Tactile agenda modal must be 100% inside viewport (got top=${agendaModalMetrics.top}, bottom=${agendaModalMetrics.bottom})`
    );
    await josePage.close();
    console.log(`   ✔ PASS: José's Hub has 1 real chair (José), 0€ clean cashier, 0 fake Madrid data, and centered tactile modal (top=${agendaModalMetrics.top}px, bottom=${agendaModalMetrics.bottom}px).`);

    console.log('\n=======================================================================');
    console.log('ALL PUPPETEER MOBILE & MULTI-TENANT EMPIRICAL VERIFICATIONS PASSED!');
    console.log('=======================================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

runVerification().catch((err) => {
  console.error('Puppeteer verification failed:', err);
  process.exit(1);
});
