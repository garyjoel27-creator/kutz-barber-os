import assert from 'node:assert';
import https from 'node:https';
import tls from 'node:tls';
import zlib from 'node:zlib';
import puppeteer from 'puppeteer';

const BASE_URL = 'https://luminadesk-gary.netlify.app';

// Helper to perform HTTP request with options
function httpRequest(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 15000,
    };

    const startTime = Date.now();
    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const duration = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          rawBuffer,
          duration,
          socket: res.socket,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${urlStr}`));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Helper to inspect SSL certificate
function checkTlsCertificate(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const socket = tls.connect({
      host: url.hostname,
      port: 443,
      servername: url.hostname,
      rejectUnauthorized: true,
    }, () => {
      const cert = socket.getPeerCertificate(true);
      const authorized = socket.authorized;
      const protocol = socket.getProtocol();
      const cipher = socket.getCipher();
      socket.end();
      resolve({ cert, authorized, protocol, cipher });
    });
    socket.on('error', reject);
    socket.setTimeout(10000, () => {
      socket.destroy();
      reject(new Error('TLS handshake timeout'));
    });
  });
}

async function runChallengerTests() {
  console.log('================================================================');
  console.log('CHALLENGER M5: ADVERSARIAL PRODUCTION ENDPOINT & PERFORMANCE TEST');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  let totalChallenges = 0;
  let passedChallenges = 0;

  function record(name, pass, details = '') {
    totalChallenges++;
    if (pass) {
      passedChallenges++;
      console.log(`  ✔ [PASS] ${name}${details ? ' - ' + details : ''}`);
    } else {
      console.error(`  ✖ [FAIL] ${name}${details ? ' - ' + details : ''}`);
      throw new Error(`Challenge Failed: ${name}: ${details}`);
    }
  }

  // =========================================================================
  // 1. SSL CERTIFICATE & TLS INTEGRITY
  // =========================================================================
  console.log('\n--- 1. SSL Certificate & TLS Protocol Inspection ---');
  {
    const tlsInfo = await checkTlsCertificate(BASE_URL);
    record('TLS Authorized', tlsInfo.authorized === true, `Authorized: ${tlsInfo.authorized}`);
    record('TLS Protocol Modern', ['TLSv1.2', 'TLSv1.3'].includes(tlsInfo.protocol), `Protocol: ${tlsInfo.protocol}`);
    record('Cipher Strength', Boolean(tlsInfo.cipher && tlsInfo.cipher.name), `Cipher: ${tlsInfo.cipher?.name}`);

    const now = Date.now();
    const validFrom = new Date(tlsInfo.cert.valid_from).getTime();
    const validTo = new Date(tlsInfo.cert.valid_to).getTime();
    record('Certificate Not Expired', now >= validFrom && now <= validTo, `Valid until: ${tlsInfo.cert.valid_to}`);
    record('Certificate Subject CN / SAN', Boolean(tlsInfo.cert.subject && (tlsInfo.cert.subjectaltname || tlsInfo.cert.subject.CN)), `Subject: ${tlsInfo.cert.subject.CN}`);
  }

  // =========================================================================
  // 2. ROOT ENDPOINT SECURITY & EDGE HEADERS
  // =========================================================================
  console.log('\n--- 2. Edge Response Headers & Security Policies ---');
  let rootHtml = '';
  let cssPath = '';
  let jsPath = '';
  {
    const res = await httpRequest(BASE_URL);
    record('Root Status 200 OK', res.statusCode === 200, `HTTP ${res.statusCode}`);
    record('Server is Netlify', res.headers.server?.toLowerCase().includes('netlify'), `Server: ${res.headers.server}`);
    record('Strict-Transport-Security (HSTS) Header', Boolean(res.headers['strict-transport-security']), `HSTS: ${res.headers['strict-transport-security']}`);
    record('HSTS Includes Long Max-Age', res.headers['strict-transport-security']?.includes('max-age=31536000'), `Verified max-age=31536000`);
    record('X-Nf-Request-Id Edge Header Present', Boolean(res.headers['x-nf-request-id']), `Request-ID: ${res.headers['x-nf-request-id']}`);
    record('Content-Type is text/html', res.headers['content-type']?.includes('text/html'), `Content-Type: ${res.headers['content-type']}`);

    rootHtml = res.rawBuffer.toString('utf-8');
    record('HTML contains root div', rootHtml.includes('id="root"'), 'Verified #root container');
    record('HTML contains KUTZ title', rootHtml.includes('KUTZ // BARBER OS'), 'Verified document title');

    // Extract asset references
    const cssMatch = rootHtml.match(/href="(\/assets\/[^"]+\.css)"/);
    const jsMatch = rootHtml.match(/src="(\/assets\/[^"]+\.js)"/);
    if (cssMatch) cssPath = cssMatch[1];
    if (jsMatch) jsPath = jsMatch[1];
    record('Found Production CSS Asset', Boolean(cssPath), `CSS: ${cssPath}`);
    record('Found Production JS Asset', Boolean(jsPath), `JS: ${jsPath}`);
  }

  // =========================================================================
  // 3. SPA DEEP REWRITE STRESS (Wildcard rewrite /* /index.html 200)
  // =========================================================================
  console.log('\n--- 3. SPA Wildcard Rewrite Resilience ---');
  const testRoutes = [
    '/unknown-route-123',
    '/clients/alex-rivera-999',
    '/nested/deep/path/that/does/not/exist',
    '/special-characters_123%20test',
    '/admin/login/recovery?ref=challenger'
  ];

  for (const route of testRoutes) {
    const res = await httpRequest(`${BASE_URL}${route}`);
    const is200 = res.statusCode === 200;
    const bodyStr = res.rawBuffer.toString('utf-8');
    const isHtml = res.headers['content-type']?.includes('text/html') && bodyStr.includes('id="root"');
    const not404Page = !bodyStr.includes('Page Not Found') && !bodyStr.includes('Not Found - Netlify');
    record(`SPA Rewrite on "${route}"`, is200 && isHtml && not404Page, `Status: ${res.statusCode}, Length: ${res.rawBuffer.length}b`);
  }

  // =========================================================================
  // 4. ASSET LOAD, ENCODING & COMPRESSION VERIFICATION (GZIP / BROTLI)
  // =========================================================================
  console.log('\n--- 4. Asset Compression & Encoding Verification ---');
  const assetsToTest = [
    { name: 'Root HTML', path: '/' },
    { name: 'Main CSS', path: cssPath },
    { name: 'Main JS', path: jsPath },
  ];

  for (const asset of assetsToTest) {
    if (!asset.path) continue;
    const assetUrl = `${BASE_URL}${asset.path}`;

    // Test GZIP
    const gzipRes = await httpRequest(assetUrl, {
      headers: { 'Accept-Encoding': 'gzip' }
    });
    record(`${asset.name} GZIP response 200`, gzipRes.statusCode === 200, `HTTP ${gzipRes.statusCode}`);
    const gzipEncoding = gzipRes.headers['content-encoding'];
    record(`${asset.name} Content-Encoding includes gzip`, gzipEncoding === 'gzip', `Encoding: ${gzipEncoding}`);

    let decompressedGzip;
    try {
      decompressedGzip = zlib.gunzipSync(gzipRes.rawBuffer);
    } catch (e) {
      decompressedGzip = null;
    }
    record(`${asset.name} GZIP Payload Decompresses Successfully`, Boolean(decompressedGzip && decompressedGzip.length > 0), `Decompressed size: ${decompressedGzip?.length}b`);

    // Test BROTLI
    const brRes = await httpRequest(assetUrl, {
      headers: { 'Accept-Encoding': 'br' }
    });
    record(`${asset.name} Brotli response 200`, brRes.statusCode === 200, `HTTP ${brRes.statusCode}`);
    const brEncoding = brRes.headers['content-encoding'];
    record(`${asset.name} Content-Encoding includes br`, brEncoding === 'br', `Encoding: ${brEncoding}`);

    let decompressedBr;
    try {
      decompressedBr = zlib.brotliDecompressSync(brRes.rawBuffer);
    } catch (e) {
      decompressedBr = null;
    }
    record(`${asset.name} Brotli Payload Decompresses Successfully`, Boolean(decompressedBr && decompressedBr.length > 0), `Decompressed size: ${decompressedBr?.length}b`);

    // Verify uncompressed or fallback content matches
    if (decompressedGzip && decompressedBr) {
      record(`${asset.name} GZIP and Brotli payloads match byte-for-byte`, decompressedGzip.equals(decompressedBr), `Size: ${decompressedGzip.length} bytes`);
    }

    // Domain content check on JS and CSS
    if (asset.name === 'Main CSS') {
      const cssContent = decompressedGzip.toString('utf-8');
      record('CSS contains .perspective-1000', cssContent.includes('perspective-1000'), 'Found 3D perspective utility');
      record('CSS contains .rotate-y-180', cssContent.includes('rotate-y-180'), 'Found 3D flip card utility');
    }
    if (asset.name === 'Main JS') {
      const jsContent = decompressedGzip.toString('utf-8');
      record('JS contains Web Audio SoundFx', jsContent.includes('soundFx') || jsContent.includes('playFlip') || jsContent.includes('AudioContext'), 'Found procedural audio');
      record('JS contains Studio OS / Barber formula', jsContent.includes('KUTZ') || jsContent.includes('STUDIO OS') || jsContent.includes('fade'), 'Found Barber domain code');
    }
  }

  // =========================================================================
  // 5. HIGH-CONCURRENCY ENDPOINT STRESS TEST
  // =========================================================================
  console.log('\n--- 5. High-Concurrency Burst Stress Test ---');
  const CONCURRENT_REQUESTS = 50;
  console.log(`Sending ${CONCURRENT_REQUESTS} parallel GET requests to ${BASE_URL}...`);
  const burstStart = Date.now();
  const promises = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises.push(httpRequest(BASE_URL));
  }

  const results = await Promise.allSettled(promises);
  const totalBurstDuration = Date.now() - burstStart;

  const fulfilled = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const rejected = results.filter(r => r.status === 'rejected');

  record('0 Request Failures in 50-burst', rejected.length === 0, `Rejected: ${rejected.length}`);
  const status200Count = fulfilled.filter(r => r.statusCode === 200).length;
  record('100% HTTP 200 OK Rate', status200Count === CONCURRENT_REQUESTS, `${status200Count}/${CONCURRENT_REQUESTS} passed`);

  const durations = fulfilled.map(r => r.duration).sort((a, b) => a - b);
  const minLatency = durations[0];
  const maxLatency = durations[durations.length - 1];
  const avgLatency = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const p95Index = Math.floor(durations.length * 0.95);
  const p95Latency = durations[p95Index];

  console.log(`  Latency Metrics (50 requests):`);
  console.log(`    - Min: ${minLatency}ms`);
  console.log(`    - Avg: ${avgLatency}ms`);
  console.log(`    - P95: ${p95Latency}ms`);
  console.log(`    - Max: ${maxLatency}ms`);
  console.log(`    - Total burst time: ${totalBurstDuration}ms`);

  record('Average Latency under 1200ms', avgLatency < 1200, `Avg: ${avgLatency}ms`);
  record('P95 Latency under 1500ms', p95Latency < 1500, `P95: ${p95Latency}ms`);

  // =========================================================================
  // 6. HEADLESS BROWSER ADVERSARIAL NAVIGATION & CLIENT STRESS
  // =========================================================================
  console.log('\n--- 6. Headless Browser Stress & SPA Navigation ---');
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

    // Fast back-and-forth SPA navigation
    console.log('  Navigating rapidly across SPA routes (/ -> /clients -> /unknown -> /)...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.goto(`${BASE_URL}/clients`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.goto(`${BASE_URL}/unknown-stress-test`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 30000 });

    const finalTitle = await page.title();
    record('App recovers to valid UI after deep 404 path', finalTitle.includes('KUTZ // BARBER OS'), `Title: ${finalTitle}`);

    // Verify 3D card exists and can flip multiple times without throwing
    await page.goto(`${BASE_URL}/clients`, { waitUntil: 'networkidle0', timeout: 30000 });
    const cardFlippedSuccessfully = await page.evaluate(async () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const flipBtn = btns.find(b => b.innerText.includes('VOLTEAR') || b.innerText.includes('FICHA') || b.title?.includes('Voltear'));
      if (!flipBtn) return false;

      // Flip front to back
      flipBtn.click();
      await new Promise(r => setTimeout(r, 400));
      // Flip back to front
      flipBtn.click();
      await new Promise(r => setTimeout(r, 400));
      return true;
    });
    record('Card flippable back-and-forth dynamically', cardFlippedSuccessfully, 'Double flip tested');

    // Filter benign console warnings
    const fatalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('font'));
    record('Zero Fatal Browser Console Errors', fatalErrors.length === 0, `Errors: ${fatalErrors.length}`);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log(`CHALLENGER VERDICT: ALL ${totalChallenges}/${totalChallenges} ADVERSARIAL TESTS PASSED!`);
  console.log('================================================================');
}

runChallengerTests().catch(err => {
  console.error('\n✖ CHALLENGE TEST CRASHED:', err);
  process.exit(1);
});
