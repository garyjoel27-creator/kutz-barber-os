import assert from 'node:assert';
import puppeteer from 'puppeteer';

const PROD_BASE_URL = 'https://luminadesk-gary.netlify.app';

const VIEWPORTS = [
  { name: 'Mobile', width: 390, height: 844 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1280, height: 800 }
];

async function runEmpiricalStressSuite() {
  console.log('========================================================================');
  console.log('CHALLENGER 2 EMPIRICAL STRESS TEST HARNESS — MILESTONE M5 REMEDIATION');
  console.log(`Target Production URL: ${PROD_BASE_URL}`);
  console.log(`Execution Timestamp: ${new Date().toISOString()}`);
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    test1_dashboardDirectNavigation: { passed: false, details: {} },
    test2_manifestIconsValidation: { passed: false, details: {} },
    test3_flipCardAndResponsiveness: { passed: false, details: [] },
    runtimeErrors: [],
    runtimeWarnings: []
  };

  try {
    const page = await browser.newPage();

    // Attach comprehensive console and error listeners
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.error(`[CONSOLE ERROR]: ${text}`);
        results.runtimeErrors.push(text);
      } else if (type === 'warn') {
        console.warn(`[CONSOLE WARN]: ${text}`);
        results.runtimeWarnings.push(text);
      }
    });

    page.on('pageerror', err => {
      console.error(`[PAGE UNCAUGHT ERROR]: ${err.message}`);
      results.runtimeErrors.push(err.message);
    });

    page.on('requestfailed', req => {
      // Log failed network requests
      const url = req.url();
      const failure = req.failure();
      console.warn(`[NETWORK REQUEST FAILED]: ${url} -> ${failure ? failure.errorText : 'unknown'}`);
    });

    // -------------------------------------------------------------------------
    // REQUIREMENT 1: DIRECT NAVIGATION TO /dashboard
    // -------------------------------------------------------------------------
    console.log('>>> [TEST 1] DIRECT NAVIGATION TO https://luminadesk-gary.netlify.app/dashboard');
    await page.setViewport({ width: 1280, height: 800 });

    const dashUrl = `${PROD_BASE_URL}/dashboard`;
    console.log(`Navigating directly to ${dashUrl}...`);
    const dashResponse = await page.goto(dashUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    const dashStatus = dashResponse.status();
    console.log(`Response HTTP Status: ${dashStatus}`);
    assert.strictEqual(dashStatus, 200, 'Direct navigation to /dashboard must return HTTP 200 OK');

    const pageTitle = await page.title();
    console.log(`Page Title: "${pageTitle}"`);
    assert.ok(pageTitle.includes('KUTZ // BARBER OS'), 'Page title must contain "KUTZ // BARBER OS"');

    // Inspect #root innerHTML
    const rootMetrics = await page.evaluate(() => {
      const root = document.getElementById('root');
      if (!root) return { exists: false, length: 0, text: '' };
      return {
        exists: true,
        length: root.innerHTML.length,
        text: root.innerText || ''
      };
    });

    console.log(`Root exists: ${rootMetrics.exists}, innerHTML length: ${rootMetrics.length} chars`);
    assert.ok(rootMetrics.exists, '#root DOM node must exist');
    assert.ok(rootMetrics.length > 5000, `#root innerHTML must be substantial (got ${rootMetrics.length} chars)`);

    // Verify Zone A: Real-Time Chairs
    const hasRealTimeChairs = rootMetrics.text.includes('ESTADO DE SILLONES EN TIEMPO REAL') || rootMetrics.text.includes('SILLÓN 0');
    console.log(`Zone A (Real-Time Chairs) rendered: ${hasRealTimeChairs}`);
    assert.ok(hasRealTimeChairs, 'Zone A: Real-Time Chairs must be rendered on /dashboard');

    // Verify Zone B: Walk-In Queue
    const hasWalkInQueue = rootMetrics.text.includes('COLA VIVA // WALK-INS');
    console.log(`Zone B (Walk-In Queue) rendered: ${hasWalkInQueue}`);
    assert.ok(hasWalkInQueue, 'Zone B: Walk-In Queue must be rendered on /dashboard');

    // Verify Zone C: Daily Bento Cards
    const hasDailyBentoCards = rootMetrics.text.includes('CLIENTES DEL DÍA') || rootMetrics.text.includes('RETOQUE DE FADE');
    console.log(`Zone C (Daily Bento Cards) header rendered: ${hasDailyBentoCards}`);
    assert.ok(hasDailyBentoCards, 'Zone C: Daily Clients header must be rendered on /dashboard');

    const bentoCardCount = await page.evaluate(() => document.querySelectorAll('.perspective-1000').length);
    console.log(`Zone C 3D Bento Card count on /dashboard: ${bentoCardCount}`);
    assert.ok(bentoCardCount >= 3, `Expected at least 3 3D Bento cards on /dashboard, got ${bentoCardCount}`);

    // Verify Chair Interaction: Cycle CH-01 status
    console.log('Testing Chair status cycling interaction on /dashboard...');
    const chairCyclingResult = await page.evaluate(async () => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText && (b.innerText.includes('EN CORTE') || b.innerText.includes('WALK-IN') || b.innerText.includes('RITUAL'))
      );
      if (!btn) return { success: false, reason: 'Badge button not found' };
      const initial = btn.innerText.trim();
      btn.click();
      await new Promise(r => setTimeout(r, 300));
      const updated = btn.innerText.trim();
      return { success: true, initial, updated, changed: initial !== updated };
    });
    console.log('Chair status cycling test:', chairCyclingResult);
    assert.ok(chairCyclingResult.success && chairCyclingResult.changed, 'Chair status must cycle upon click');

    // Verify Console Errors and Warnings on /dashboard
    const dashboardWarnings = results.runtimeWarnings.filter(w => w.includes('No routes matched location "/dashboard"'));
    console.log(`Matching "No routes matched location /dashboard" warnings: ${dashboardWarnings.length}`);
    assert.strictEqual(dashboardWarnings.length, 0, 'Must have 0 "No routes matched location /dashboard" warnings!');

    const fatalErrors = results.runtimeErrors.filter(e => !e.includes('favicon') && !e.includes('font'));
    console.log(`Total fatal console errors on /dashboard: ${fatalErrors.length}`);
    assert.strictEqual(fatalErrors.length, 0, `Expected 0 console errors on /dashboard, got: ${JSON.stringify(fatalErrors)}`);

    results.test1_dashboardDirectNavigation = {
      passed: true,
      details: {
        status: dashStatus,
        title: pageTitle,
        rootLength: rootMetrics.length,
        chairsRendered: hasRealTimeChairs,
        walkInQueueRendered: hasWalkInQueue,
        bentoCardCount,
        chairCycling: chairCyclingResult,
        consoleErrors: fatalErrors.length,
        noRouteWarnings: dashboardWarnings.length
      }
    };
    console.log('✔ [TEST 1 PASSED]: /dashboard rendered full content with 0 errors/warnings\n');

    // -------------------------------------------------------------------------
    // REQUIREMENT 2: PWA MANIFEST & ICON DECODE VERIFICATION
    // -------------------------------------------------------------------------
    console.log('>>> [TEST 2] PWA MANIFEST & ICON ASSET DECODE VERIFICATION');

    const manifestUrl = `${PROD_BASE_URL}/manifest.webmanifest`;
    console.log(`Fetching and parsing webmanifest: ${manifestUrl}...`);

    const manifestData = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
        const json = await res.json();
        return { ok: true, status: res.status, json };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }, manifestUrl);

    assert.ok(manifestData.ok, `Manifest fetch failed: ${JSON.stringify(manifestData)}`);
    console.log('Manifest loaded successfully:');
    console.log(`  Name: "${manifestData.json.name}"`);
    console.log(`  Short Name: "${manifestData.json.short_name}"`);
    console.log(`  Icons defined: ${manifestData.json.icons ? manifestData.json.icons.length : 0}`);
    assert.ok(manifestData.json.icons && manifestData.json.icons.length >= 2, 'Manifest must declare at least 2 icons');

    // Test real in-browser image decoding for every icon asset
    const iconAssetUrls = [
      `${PROD_BASE_URL}/pwa-192x192.png`,
      `${PROD_BASE_URL}/pwa-512x512.png`,
      `${PROD_BASE_URL}/apple-touch-icon.png`,
      `${PROD_BASE_URL}/favicon.svg`
    ];

    console.log('Testing in-browser Image decode for all icon assets...');
    const iconDecodeResults = await page.evaluate(async (icons) => {
      const results = [];
      for (const src of icons) {
        const start = performance.now();
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = src;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error(`Failed to load image at ${src}`));
          });
          // Decode image using HTMLImageElement.decode() API
          await img.decode();
          const durationMs = Math.round(performance.now() - start);
          results.push({
            src,
            loaded: true,
            decoded: true,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            durationMs
          });
        } catch (err) {
          results.push({
            src,
            loaded: false,
            decoded: false,
            error: err.message
          });
        }
      }
      return results;
    }, iconAssetUrls);

    console.log('Icon asset decode test results:');
    for (const r of iconDecodeResults) {
      console.log(`  Asset: ${r.src}`);
      console.log(`    Status: loaded=${r.loaded}, decoded=${r.decoded}, dims=${r.naturalWidth}x${r.naturalHeight}, time=${r.durationMs}ms`);
      assert.strictEqual(r.loaded, true, `Asset ${r.src} failed to load!`);
      assert.strictEqual(r.decoded, true, `Asset ${r.src} failed in-browser decode!`);
      assert.ok(r.naturalWidth > 0 && r.naturalHeight > 0, `Asset ${r.src} has invalid dimensions!`);
    }

    // Verify exact expected dimensions
    const icon192 = iconDecodeResults.find(r => r.src.includes('pwa-192x192.png'));
    assert.strictEqual(icon192.naturalWidth, 192, 'pwa-192x192.png width must be 192');
    assert.strictEqual(icon192.naturalHeight, 192, 'pwa-192x192.png height must be 192');

    const icon512 = iconDecodeResults.find(r => r.src.includes('pwa-512x512.png'));
    assert.strictEqual(icon512.naturalWidth, 512, 'pwa-512x512.png width must be 512');
    assert.strictEqual(icon512.naturalHeight, 512, 'pwa-512x512.png height must be 512');

    const appleIcon = iconDecodeResults.find(r => r.src.includes('apple-touch-icon.png'));
    assert.strictEqual(appleIcon.naturalWidth, 180, 'apple-touch-icon.png width must be 180');
    assert.strictEqual(appleIcon.naturalHeight, 180, 'apple-touch-icon.png height must be 180');

    results.test2_manifestIconsValidation = {
      passed: true,
      details: {
        manifestName: manifestData.json.name,
        iconsDeclared: manifestData.json.icons.length,
        iconDecodeResults
      }
    };
    console.log('✔ [TEST 2 PASSED]: All manifest icons downloaded and decoded cleanly without errors\n');

    // -------------------------------------------------------------------------
    // REQUIREMENT 3: 3D FLIP CARD INTERACTION & RESPONSIVENESS (390px, 768px, 1280px)
    // -------------------------------------------------------------------------
    console.log('>>> [TEST 3] 3D FLIP CARD INTERACTION & RESPONSIVENESS ACROSS VIEWPORTS');

    for (const vp of VIEWPORTS) {
      console.log(`\n======================================================`);
      console.log(`TESTING VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`======================================================`);

      await page.setViewport({ width: vp.width, height: vp.height });

      // Test 3.1: Dashboard Responsive Layout & Zero Horizontal Overflow
      console.log(`Checking /dashboard at ${vp.width}px...`);
      await page.goto(`${PROD_BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 400));

      const dashOverflow = await page.evaluate((vpWidth) => {
        const bodyScroll = document.body.scrollWidth;
        const htmlScroll = document.documentElement.scrollWidth;
        const innerW = window.innerWidth;
        const overflowPx = Math.max(0, bodyScroll - innerW, htmlScroll - innerW);
        return {
          innerW,
          bodyScroll,
          htmlScroll,
          overflowPx,
          hasOverflow: overflowPx > 1
        };
      }, vp.width);

      console.log(`  Dashboard layout metrics: innerWidth=${dashOverflow.innerW}, htmlScroll=${dashOverflow.htmlScroll}, overflow=${dashOverflow.overflowPx}px`);
      assert.strictEqual(dashOverflow.hasOverflow, false, `Dashboard at ${vp.width}px must have ZERO horizontal overflow (got ${dashOverflow.overflowPx}px)`);

      // Test 3.2: Clients Route '/clients' Responsive Layout & Zero Horizontal Overflow
      console.log(`Checking /clients at ${vp.width}px...`);
      await page.goto(`${PROD_BASE_URL}/clients`, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 400));

      const clientsOverflow = await page.evaluate((vpWidth) => {
        const bodyScroll = document.body.scrollWidth;
        const htmlScroll = document.documentElement.scrollWidth;
        const innerW = window.innerWidth;
        const overflowPx = Math.max(0, bodyScroll - innerW, htmlScroll - innerW);
        const cardCount = document.querySelectorAll('.perspective-1000').length;
        return {
          innerW,
          bodyScroll,
          htmlScroll,
          overflowPx,
          hasOverflow: overflowPx > 1,
          cardCount
        };
      }, vp.width);

      console.log(`  Clients layout metrics: innerWidth=${clientsOverflow.innerW}, htmlScroll=${clientsOverflow.htmlScroll}, overflow=${clientsOverflow.overflowPx}px, cards=${clientsOverflow.cardCount}`);
      assert.strictEqual(clientsOverflow.hasOverflow, false, `Clients at ${vp.width}px must have ZERO horizontal overflow (got ${clientsOverflow.overflowPx}px)`);
      assert.ok(clientsOverflow.cardCount >= 3, `Expected at least 3 cards at ${vp.width}px, got ${clientsOverflow.cardCount}`);

      // Test 3.3: 3D Flip Card Flip-to-Back and Flip-to-Front
      console.log(`  Testing 3D Flip Card interaction on /clients at ${vp.width}px...`);

      // 1. Initial State Check
      const initialCardState = await page.evaluate(() => {
        const firstCard = document.querySelector('.perspective-1000');
        if (!firstCard) return null;
        const inner = firstCard.querySelector('.transform-style-3d');
        const flipBtn = firstCard.querySelector('button[title*="Girar"]') || Array.from(firstCard.querySelectorAll('button')).find(b => b.innerText.includes('Voltear'));
        return {
          found: true,
          perspectiveClass: firstCard.classList.contains('perspective-1000'),
          transformStyle3dClass: inner ? inner.classList.contains('transform-style-3d') : false,
          hasRotateY180: inner ? inner.classList.contains('rotate-y-180') : false,
          hasRotateY0: inner ? inner.classList.contains('rotate-y-0') : false,
          hasFlipBtn: !!flipBtn
        };
      });

      assert.ok(initialCardState && initialCardState.found, `Card must be present at ${vp.width}px`);
      assert.ok(initialCardState.perspectiveClass, 'Card container must have perspective-1000');
      assert.ok(initialCardState.transformStyle3dClass, 'Card inner must have transform-style-3d');
      assert.ok(!initialCardState.hasRotateY180, 'Card must NOT be rotated 180deg initially');
      assert.ok(initialCardState.hasFlipBtn, 'Flip button must be present on front face');

      // 2. Click Flip to Back Face
      console.log(`  Triggering flip to back face at ${vp.width}px...`);
      const flipClicked = await page.evaluate(() => {
        const firstCard = document.querySelector('.perspective-1000');
        if (!firstCard) return false;
        const flipBtn = firstCard.querySelector('button[title*="Girar"]') || Array.from(firstCard.querySelectorAll('button')).find(b => b.innerText.includes('Voltear'));
        if (flipBtn) {
          flipBtn.click();
          return true;
        }
        return false;
      });
      assert.ok(flipClicked, `Flip button click must succeed at ${vp.width}px`);

      // Allow 650ms for CSS transition
      await new Promise(r => setTimeout(r, 700));

      // 3. Verify Flipped State & Back Face Content
      const flippedCardState = await page.evaluate(() => {
        const firstCard = document.querySelector('.perspective-1000');
        if (!firstCard) return null;
        const inner = firstCard.querySelector('.transform-style-3d');
        const computedTransform = window.getComputedStyle(inner).transform;
        const text = firstCard.innerText.toLowerCase();
        const hasBackFlipBtn = !!firstCard.querySelector('button[title*="frontal"]');
        return {
          classes: inner.className,
          computedTransform,
          hasRotateY180: inner.classList.contains('rotate-y-180'),
          hasFormula: text.includes('#000') || text.includes('shaver') || text.includes('fórmula') || text.includes('ficha técnica'),
          hasPeines: text.includes('#0.5') && text.includes('#1.5'),
          hasQuickLogger: text.includes('registrar corte rápido') || text.includes('guardar'),
          hasBackFlipBtn
        };
      });

      console.log(`  Flipped state: rotate-y-180=${flippedCardState.hasRotateY180}, transform=${flippedCardState.computedTransform}`);
      console.log(`  Formula exposed: ${flippedCardState.hasFormula}, Peines: ${flippedCardState.hasPeines}, QuickLogger: ${flippedCardState.hasQuickLogger}`);
      assert.strictEqual(flippedCardState.hasRotateY180, true, `Card inner must have rotate-y-180 at ${vp.width}px`);
      assert.strictEqual(flippedCardState.hasFormula, true, `Back face must expose technical formula at ${vp.width}px`);
      assert.strictEqual(flippedCardState.hasPeines, true, `Back face must expose peines graduation at ${vp.width}px`);
      assert.strictEqual(flippedCardState.hasQuickLogger, true, `Back face must expose quick cut logger at ${vp.width}px`);

      // 4. Click Flip Back to Front Face
      console.log(`  Triggering flip back to front face at ${vp.width}px...`);
      const flipBackClicked = await page.evaluate(() => {
        const firstCard = document.querySelector('.perspective-1000');
        if (!firstCard) return false;
        const backBtn = firstCard.querySelector('button[title*="frontal"]');
        if (backBtn) {
          backBtn.click();
          return true;
        }
        return false;
      });
      assert.ok(flipBackClicked, `Back flip button click must succeed at ${vp.width}px`);

      await new Promise(r => setTimeout(r, 700));

      // 5. Verify Restored Front State
      const restoredCardState = await page.evaluate(() => {
        const firstCard = document.querySelector('.perspective-1000');
        if (!firstCard) return null;
        const inner = firstCard.querySelector('.transform-style-3d');
        return {
          hasRotateY180: inner.classList.contains('rotate-y-180'),
          hasRotateY0: inner.classList.contains('rotate-y-0')
        };
      });

      console.log(`  Restored state: rotate-y-180=${restoredCardState.hasRotateY180}, rotate-y-0=${restoredCardState.hasRotateY0}`);
      assert.strictEqual(restoredCardState.hasRotateY180, false, `Card must NOT have rotate-y-180 after returning to front at ${vp.width}px`);
      assert.strictEqual(restoredCardState.hasRotateY0, true, `Card must have rotate-y-0 after returning to front at ${vp.width}px`);

      // 6. Rapid Consecutive Flip Stress Test (prevents desynchronization)
      console.log(`  Testing rapid consecutive flip toggling at ${vp.width}px...`);
      const rapidStressResult = await page.evaluate(async () => {
        const card = document.querySelector('.perspective-1000');
        if (!card) return { success: false, reason: 'Card not found' };
        const inner = card.querySelector('.transform-style-3d');
        const frontBtn = card.querySelector('button[title*="Girar"]') || Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes('Voltear'));
        
        // Rapid toggle 1
        frontBtn.click();
        await new Promise(r => setTimeout(r, 100)); // Interrupt mid-animation
        const backBtn = card.querySelector('button[title*="frontal"]');
        if (backBtn) backBtn.click();
        
        // Wait for settling
        await new Promise(r => setTimeout(r, 800));
        return {
          success: true,
          finalClasses: inner.className,
          isClean: !inner.classList.contains('rotate-y-180') && inner.classList.contains('rotate-y-0')
        };
      });
      console.log(`  Rapid flip stress result:`, rapidStressResult);
      assert.ok(rapidStressResult.success && rapidStressResult.isClean, `Rapid flip stress must leave card in clean state at ${vp.width}px`);

      results.test3_flipCardAndResponsiveness.details.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        dashboardOverflow: dashOverflow.overflowPx,
        clientsOverflow: clientsOverflow.overflowPx,
        flipToBackVerified: flippedCardState.hasRotateY180,
        formulaRevealed: flippedCardState.hasFormula,
        flipToFrontVerified: restoredCardState.hasRotateY0,
        rapidStressPassed: rapidStressResult.isClean
      });

      console.log(`✔ [VIEWPORT ${vp.name} PASSED]: Zero overflow, 3D flip forward/back verified, rapid stress clean.`);
    }

    results.test3_flipCardAndResponsiveness.passed = true;

    // Final Error Tally
    const finalFatalErrors = results.runtimeErrors.filter(e => !e.includes('favicon') && !e.includes('font'));
    console.log(`\n======================================================`);
    console.log(`FINAL BROWSER ERROR AUDIT: ${finalFatalErrors.length} fatal errors`);
    console.log(`======================================================`);
    assert.strictEqual(finalFatalErrors.length, 0, `Expected 0 runtime browser console errors, got ${finalFatalErrors.length}`);

    console.log('\n========================================================================');
    console.log('CHALLENGER 2: ALL EMPIRICAL BROWSER TESTS PASSED 100% WITH ZERO DEFECTS');
    console.log('========================================================================\n');

    try {
      await Promise.race([
        browser.close(),
        new Promise(r => setTimeout(r, 2000))
      ]);
    } catch {
      // Ignore close timeouts
    }
    return results;
  } catch (err) {
    try { await browser.close(); } catch {}
    throw err;
  }
}

runEmpiricalStressSuite().then(res => {
  console.log('\nEXECUTION RESULTS SUMMARY:\n', JSON.stringify(res, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('\n❌ EMPIRICAL STRESS TEST FAILED:', err);
  process.exit(1);
});
