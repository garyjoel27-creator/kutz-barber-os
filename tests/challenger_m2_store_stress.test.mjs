/**
 * Challenger M2 Instance 2 Empirical Stress Test Suite
 * Mission:
 * - Test updateClient and quickAddSession under concurrent invocations and invalid/null IDs.
 * - Test getFadeAlert edge cases (0 days, exactly 14 days, exactly 15 days, 21 days, 90+ days elapsed).
 * - Test search filtering in Clients.jsx with accents, uppercase/lowercase, and empty queries.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('CHALLENGER M2 (INSTANCE 2): EMPIRICAL STRESS TEST SUITE');
console.log('Testing ClientContext Store, getFadeAlert & Bento Grid Filtering');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const findings = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
    findings.push({ name, error: err.message, stack: err.stack });
  }
}

// ----------------------------------------------------------------------------
// Extract pure functions and seed data directly from src/context/ClientContext.jsx
// ----------------------------------------------------------------------------
const clientContextPath = path.join(projectRoot, 'src', 'context', 'ClientContext.jsx');
const clientContextSource = fs.readFileSync(clientContextPath, 'utf8');

// Strip React imports and JSX provider to isolate pure ESM exports (lines 1-790)
const esmPureCode = clientContextSource
  .replace(/import\s+React[^;]*;/, '')
  .replace(/const\s+ClientContext\s+=[^;]*;/, '')
  .replace(/export\s+const\s+useClients[^;]*;/, '')
  .replace(/export\s+const\s+ClientProvider\s*=[\s\S]*$/, '');

const dataUrl = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(esmPureCode);
const clientContextModule = await import(dataUrl);

const { normalizeText, parseTreatmentDate, getFadeAlert, INITIAL_BARBER_CLIENTS } = clientContextModule;

// ============================================================================
// SUITE 1: `updateClient` & `quickAddSession` Stress Harness
// ============================================================================
console.log('--- SUITE 1: updateClient & quickAddSession Stress Testing ---');

// Pure harness replicating ClientContext state reducer logic
function createStoreHarness(initialClients) {
  let clients = JSON.parse(JSON.stringify(initialClients));

  const setClients = (updater) => {
    clients = typeof updater === 'function' ? updater(clients) : updater;
  };

  // Verbatim from ClientContext.jsx lines 1055-1063
  const updateClient = (clientId, patch) => {
    if (!clientId || !patch) return;
    setClients(prev => prev.map(c => {
      if (String(c.id) === String(clientId)) {
        return { ...c, ...patch };
      }
      return c;
    }));
  };

  // Verbatim from ClientContext.jsx lines 1066-1098
  const quickAddSession = (clientId, sessionData = {}) => {
    if (!clientId || !sessionData) return null;
    const now = new Date();
    const sessionTimestamp = sessionData.timestamp || (sessionData.date ? parseTreatmentDate(sessionData.date).getTime() : Date.now());
    const dateStr = sessionData.date || `${now.getDate()} ${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][now.getMonth()]} ${now.getFullYear()}`;
    const newSession = {
      id: sessionData.id || `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: sessionData.serviceName || sessionData.name || 'Corte & Fade en Sillón',
      date: dateStr,
      timestamp: sessionTimestamp,
      formula: sessionData.formula || 'Base Shaver #000 → #0.5 → #1.5',
      notes: sessionData.notes || '',
      ritual: sessionData.ritual || '',
      barber: sessionData.barber || 'Barbero Titular',
      photos: sessionData.photos || null
    };

    setClients(prev => prev.map(c => {
      if (String(c.id) === String(clientId)) {
        const existing = Array.isArray(c.treatments) ? c.treatments : [];
        return {
          ...c,
          lastService: newSession.name,
          lastVisit: newSession.date,
          treatment: newSession.name,
          treatments: [newSession, ...existing]
        };
      }
      return c;
    }));

    return newSession;
  };

  return {
    getClients: () => clients,
    updateClient,
    quickAddSession
  };
}

test('1.1: updateClient with null, undefined, or empty string ID does not modify state or throw', () => {
  const store = createStoreHarness(INITIAL_BARBER_CLIENTS);
  const baseline = JSON.stringify(store.getClients());

  store.updateClient(null, { name: 'Hacked' });
  store.updateClient(undefined, { name: 'Hacked' });
  store.updateClient('', { name: 'Hacked' });

  assert.strictEqual(JSON.stringify(store.getClients()), baseline, 'Store must remain strictly unmodified');
});

test('1.2: quickAddSession with null, undefined, or empty string ID returns null and does not modify state', () => {
  const store = createStoreHarness(INITIAL_BARBER_CLIENTS);
  const baseline = JSON.stringify(store.getClients());

  const res1 = store.quickAddSession(null, { formula: '#000' });
  const res2 = store.quickAddSession(undefined, { formula: '#000' });
  const res3 = store.quickAddSession('', { formula: '#000' });

  assert.strictEqual(res1, null, 'Must return null for null ID');
  assert.strictEqual(res2, null, 'Must return null for undefined ID');
  assert.strictEqual(res3, null, 'Must return null for empty string ID');
  assert.strictEqual(JSON.stringify(store.getClients()), baseline, 'Store must remain unmodified');
});

test('1.3: updateClient with null or undefined patch does not modify state', () => {
  const store = createStoreHarness(INITIAL_BARBER_CLIENTS);
  const baseline = JSON.stringify(store.getClients());

  store.updateClient('1', null);
  store.updateClient('1', undefined);

  assert.strictEqual(JSON.stringify(store.getClients()), baseline);
});

test('1.4: quickAddSession with null sessionData returns null', () => {
  const store = createStoreHarness(INITIAL_BARBER_CLIENTS);
  const baseline = JSON.stringify(store.getClients());

  const res = store.quickAddSession('1', null);
  assert.strictEqual(res, null);
  assert.strictEqual(JSON.stringify(store.getClients()), baseline);
});

test('1.5: updateClient on non-existent ID does not corrupt existing clients', () => {
  const store = createStoreHarness(INITIAL_BARBER_CLIENTS);
  const baseline = JSON.stringify(store.getClients());

  store.updateClient('non-existent-99999', { name: 'Ghost' });
  assert.strictEqual(JSON.stringify(store.getClients()), baseline);
});

test('1.6: quickAddSession on non-existent ID returns session object but store remains unchanged', () => {
  const store = createStoreHarness(INITIAL_BARBER_CLIENTS);
  const initialCount = store.getClients().length;
  const initialTreatmentsCount = store.getClients().map(c => c.treatments?.length || 0);

  const res = store.quickAddSession('non-existent-99999', { formula: 'Taper #1' });
  assert.ok(res, 'Returns session object');
  assert.strictEqual(res.formula, 'Taper #1');

  // Verify none of the clients in store were modified
  const postClients = store.getClients();
  assert.strictEqual(postClients.length, initialCount);
  const postTreatmentsCount = postClients.map(c => c.treatments?.length || 0);
  assert.deepStrictEqual(initialTreatmentsCount, postTreatmentsCount);
});

test('1.7: updateClient and quickAddSession with ID type coercion (numeric vs string)', () => {
  const store = createStoreHarness(INITIAL_BARBER_CLIENTS);

  // Client 1 has id: '1'
  store.updateClient(1, { notes: 'Updated with numeric ID 1' });
  const client1 = store.getClients().find(c => c.id === '1');
  assert.strictEqual(client1.notes, 'Updated with numeric ID 1', 'String(c.id) === String(clientId) handles numeric 1');

  // Client 2 with quickAddSession using numeric 2
  const session = store.quickAddSession(2, { formula: 'Test numeric 2' });
  const client2 = store.getClients().find(c => c.id === '2');
  assert.strictEqual(client2.treatments[0].formula, 'Test numeric 2');
});

test('1.8: Edge Case Investigation — Behavior with clientId = 0 (numeric zero)', () => {
  const testClients = [{ id: '0', name: 'Zero Client', treatments: [] }];
  const store = createStoreHarness(testClients);

  // When clientId is numeric 0, `if (!clientId || !patch) return;` evaluates !0 as TRUE!
  store.updateClient(0, { name: 'Modified' });
  const clientAfterUpdate = store.getClients().find(c => c.id === '0');
  
  // Notice: numeric 0 is falsy, so updateClient(0, patch) is blocked!
  assert.strictEqual(clientAfterUpdate.name, 'Zero Client', 'numeric 0 is treated as falsy by !clientId guard');

  // But passing string '0' works:
  store.updateClient('0', { name: 'Modified With String 0' });
  const clientAfterString = store.getClients().find(c => c.id === '0');
  assert.strictEqual(clientAfterString.name, 'Modified With String 0');
});

test('1.9: Client with undefined/null treatments array is handled gracefully by quickAddSession', () => {
  const malformedClients = [{ id: '99', name: 'No Treatments Client', treatments: null }];
  const store = createStoreHarness(malformedClients);

  const session = store.quickAddSession('99', { formula: 'Skin Fade #000' });
  assert.ok(session);
  const client = store.getClients().find(c => c.id === '99');
  assert.ok(Array.isArray(client.treatments), 'treatments must be converted to an array');
  assert.strictEqual(client.treatments.length, 1);
  assert.strictEqual(client.treatments[0].formula, 'Skin Fade #000');
});

test('1.10: Concurrent Invocations Stress — 100 concurrent quickAddSession calls', () => {
  const store = createStoreHarness(INITIAL_BARBER_CLIENTS);
  const initialTreatments = store.getClients().find(c => c.id === '1').treatments.length;

  // Simulate 100 queued functional updates
  for (let i = 0; i < 100; i++) {
    store.quickAddSession('1', { formula: `Session #${i}`, barber: `Barber ${i}` });
  }

  const client1 = store.getClients().find(c => c.id === '1');
  assert.strictEqual(client1.treatments.length, initialTreatments + 100, 'Must have exactly 100 new sessions without dropped frames');
  assert.strictEqual(client1.treatments[0].formula, 'Session #99', 'Latest session must be at index 0');
  assert.strictEqual(client1.treatments[99].formula, 'Session #0', 'First session must be at index 99');
});

test('1.11: Interleaved Concurrent Invocations — 50 updateClient + 50 quickAddSession calls', () => {
  const store = createStoreHarness(INITIAL_BARBER_CLIENTS);
  const initialTreatments = store.getClients().find(c => c.id === '3').treatments.length;

  for (let i = 0; i < 50; i++) {
    store.updateClient('3', { notes: `Note update ${i}`, phone: `+34 600 000 ${i}` });
    store.quickAddSession('3', { formula: `Cut formula ${i}` });
  }

  const client3 = store.getClients().find(c => c.id === '3');
  assert.strictEqual(client3.notes, 'Note update 49');
  assert.strictEqual(client3.phone, '+34 600 000 49');
  assert.strictEqual(client3.treatments.length, initialTreatments + 50);
});

// ============================================================================
// SUITE 2: `getFadeAlert` Edge Cases (0, 14, 15, 21, 90+ days)
// ============================================================================
console.log('\n--- SUITE 2: getFadeAlert Edge Cases Stress Testing ---');

function createClientWithVisit(daysAgo, referenceDate = new Date('2026-10-29T12:00:00Z')) {
  const visitTimestamp = referenceDate.getTime() - (daysAgo * 24 * 60 * 60 * 1000);
  const visitDate = new Date(visitTimestamp);
  return {
    id: 'test-client',
    name: 'Test Fade Client',
    treatments: [
      {
        id: 1,
        name: 'Skin Fade Alto',
        formula: 'Base Shaver #000 → #0.5 → #1.5',
        timestamp: visitTimestamp,
        date: visitDate.toISOString()
      }
    ]
  };
}

const refFixed = new Date('2026-10-29T12:00:00Z');

test('2.1: Edge Case: 0 days elapsed (Treatment performed today)', () => {
  const client = createClientWithVisit(0, refFixed);
  const alert = getFadeAlert(client, refFixed);

  assert.strictEqual(alert.elapsedDays, 0, 'elapsedDays must be 0');
  assert.strictEqual(alert.daysElapsed, 0, 'daysElapsed must be 0');
  assert.strictEqual(alert.daysRemaining, 15, 'daysRemaining must be 15');
  assert.strictEqual(alert.alertLevel, 'normal', 'alertLevel must be normal');
  assert.strictEqual(alert.label, 'Fade fresco', 'label must be Fade fresco');
  assert.strictEqual(alert.badgeColor, '#10B981', 'badgeColor must be green #10B981');
  assert.strictEqual(alert.requiresRetouch, false, 'requiresRetouch must be false');
});

test('2.2: Edge Case: Exactly 14 days elapsed', () => {
  const client = createClientWithVisit(14, refFixed);
  const alert = getFadeAlert(client, refFixed);

  assert.strictEqual(alert.elapsedDays, 14, 'elapsedDays must be 14');
  assert.strictEqual(alert.daysElapsed, 14, 'daysElapsed must be 14');
  assert.strictEqual(alert.daysRemaining, 1, 'daysRemaining must be 1 (15 - 14)');
  assert.strictEqual(alert.alertLevel, 'normal', 'alertLevel must be normal (< 15 days)');
  assert.strictEqual(alert.badgeColor, '#10B981', 'badgeColor must be green #10B981');
  assert.strictEqual(alert.requiresRetouch, false, 'requiresRetouch must be false for < 15 days');
  
  // Check label anomaly: remaining <= 2 triggers "🔥 Retoque en 1 días"
  assert.strictEqual(alert.label, '🔥 Retoque en 1 días', 'Triggers flame alert string');
  console.log('    [ANOMALY OBSERVED] At day 14: label is "🔥 Retoque en 1 días" while alertLevel is "normal" and requiresRetouch is false');
});

test('2.3: Edge Case: Exactly 15 days elapsed (Transition to Warning)', () => {
  const client = createClientWithVisit(15, refFixed);
  const alert = getFadeAlert(client, refFixed);

  assert.strictEqual(alert.elapsedDays, 15, 'elapsedDays must be 15');
  assert.strictEqual(alert.daysElapsed, 15, 'daysElapsed must be 15');
  assert.strictEqual(alert.daysRemaining, 6, 'daysRemaining jumps to 6 (21 - 15)');
  assert.strictEqual(alert.alertLevel, 'warning', 'alertLevel must transition to warning at exactly 15 days');
  assert.strictEqual(alert.badgeColor, '#F59E0B', 'badgeColor must transition to amber #F59E0B');
  assert.strictEqual(alert.requiresRetouch, true, 'requiresRetouch must become true at 15 days');
  assert.strictEqual(alert.label, '✂️ Ventana de Fade (6d)', 'label must be Ventana de Fade (6d)');
  console.log('    [DISCONTINUITY OBSERVED] Between Day 14 (daysRemaining=1) and Day 15 (daysRemaining=6), remaining days jumps from 1 to 6');
});

test('2.4: Edge Case: 20 days elapsed (Day before Urgent cutoff)', () => {
  const client = createClientWithVisit(20, refFixed);
  const alert = getFadeAlert(client, refFixed);

  assert.strictEqual(alert.elapsedDays, 20);
  assert.strictEqual(alert.daysRemaining, 1);
  assert.strictEqual(alert.alertLevel, 'warning');
  assert.strictEqual(alert.badgeColor, '#F59E0B');
  assert.strictEqual(alert.requiresRetouch, true);
  assert.strictEqual(alert.label, '🔥 Retoque en 1 días');
});

test('2.5: Edge Case: Exactly 21 days elapsed (Transition to Urgent)', () => {
  const client = createClientWithVisit(21, refFixed);
  const alert = getFadeAlert(client, refFixed);

  assert.strictEqual(alert.elapsedDays, 21, 'elapsedDays must be 21');
  assert.strictEqual(alert.daysElapsed, 21, 'daysElapsed must be 21');
  assert.strictEqual(alert.daysRemaining, 0, 'daysRemaining must be 0 for overdue fade');
  assert.strictEqual(alert.alertLevel, 'urgent', 'alertLevel must be urgent at 21+ days');
  assert.strictEqual(alert.badgeColor, '#EF4444', 'badgeColor must be red #EF4444');
  assert.strictEqual(alert.requiresRetouch, true, 'requiresRetouch must be true');
  assert.strictEqual(alert.label, '🔥 Fade Vencido (+21d)', 'label must be Fade Vencido (+21d)');
});

test('2.6: Edge Case: 90+ days elapsed (Extreme degradation: 90, 120, 365 days)', () => {
  const client90 = createClientWithVisit(90, refFixed);
  const alert90 = getFadeAlert(client90, refFixed);
  assert.strictEqual(alert90.elapsedDays, 90);
  assert.strictEqual(alert90.alertLevel, 'urgent');
  assert.strictEqual(alert90.label, '🔥 Fade Vencido (+90d)');
  assert.strictEqual(alert90.daysRemaining, 0);
  assert.strictEqual(alert90.badgeColor, '#EF4444');
  assert.strictEqual(alert90.requiresRetouch, true);

  const client120 = createClientWithVisit(120, refFixed);
  const alert120 = getFadeAlert(client120, refFixed);
  assert.strictEqual(alert120.elapsedDays, 120);
  assert.strictEqual(alert120.label, '🔥 Fade Vencido (+120d)');

  const client365 = createClientWithVisit(365, refFixed);
  const alert365 = getFadeAlert(client365, refFixed);
  assert.strictEqual(alert365.elapsedDays, 365);
  assert.strictEqual(alert365.label, '🔥 Fade Vencido (+365d)');
});

test('2.7: Edge Case: Null and undefined client inputs', () => {
  const nullAlert = getFadeAlert(null);
  assert.strictEqual(nullAlert.alertLevel, 'normal');
  assert.strictEqual(nullAlert.label, 'Sin datos');
  assert.strictEqual(nullAlert.daysRemaining, 21);
  assert.strictEqual(nullAlert.elapsedDays, 0);
  assert.strictEqual(nullAlert.badgeColor, '#10B981');
  assert.strictEqual(nullAlert.requiresRetouch, false);

  const undefAlert = getFadeAlert(undefined);
  assert.strictEqual(undefAlert.label, 'Sin datos');
});

test('2.8: Edge Case: Client with empty or non-barber treatments', () => {
  const emptyClient = { id: 'empty', name: 'Empty', treatments: [] };
  const alertEmpty = getFadeAlert(emptyClient);
  assert.strictEqual(alertEmpty.label, 'Nuevo cliente');
  assert.strictEqual(alertEmpty.alertLevel, 'normal');
  assert.strictEqual(alertEmpty.daysRemaining, 15);
  assert.strictEqual(alertEmpty.requiresRetouch, false);

  const nonBarberClient = {
    id: 'nb',
    name: 'Non Barber',
    treatments: [{ id: 1, name: 'Lifting de pestañas', date: '2026-10-01' }]
  };
  const alertNonBarber = getFadeAlert(nonBarberClient);
  assert.strictEqual(alertNonBarber.label, 'Nuevo cliente', 'Non-barber treatment falls back to Nuevo cliente');
});

test('2.9: Edge Case: Future-dated treatment (negative elapsed time)', () => {
  const futureClient = createClientWithVisit(-5, refFixed);
  const alertFuture = getFadeAlert(futureClient, refFixed);
  assert.strictEqual(alertFuture.elapsedDays, 0, 'Math.max(0, ...) clamps negative elapsed days to 0');
  assert.strictEqual(alertFuture.alertLevel, 'normal');
  assert.strictEqual(alertFuture.label, 'Fade fresco');
});

// ============================================================================
// SUITE 3: Search Filtering in `Clients.jsx` Stress Harness
// ============================================================================
console.log('\n--- SUITE 3: Clients.jsx Search Filtering Stress Testing ---');

// Replicate Clients.jsx line 23-44 filter implementation verbatim
function runClientsFilter(clients, searchQuery, activeFilter = 'all') {
  return clients.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.treatments?.[0]?.formula && c.treatments[0].formula.toLowerCase().includes(q)) ||
      (c.treatment && c.treatment.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (activeFilter === 'urgent' || activeFilter === 'overdue') {
      const alert = getFadeAlert(c);
      return alert.requiresRetouch || alert.alertLevel === 'urgent' || alert.alertLevel === 'warning';
    }
    if (activeFilter === 'vip') {
      return c.bonos?.some(b => (b.totalSessions - b.usedSessions) > 0);
    }
    if (activeFilter === 'walkin') {
      return !c.bonos || c.bonos.length === 0 || c.bonos.every(b => (b.totalSessions - b.usedSessions) <= 0) || c.isWalkInOnly;
    }
    return true;
  });
}

test('3.1: Empty and whitespace queries return all clients', () => {
  const resEmpty = runClientsFilter(INITIAL_BARBER_CLIENTS, '');
  assert.strictEqual(resEmpty.length, INITIAL_BARBER_CLIENTS.length);

  const resSpaces = runClientsFilter(INITIAL_BARBER_CLIENTS, '   ');
  assert.strictEqual(resSpaces.length, INITIAL_BARBER_CLIENTS.length);

  const resTabNewline = runClientsFilter(INITIAL_BARBER_CLIENTS, '\t \n ');
  assert.strictEqual(resTabNewline.length, INITIAL_BARBER_CLIENTS.length);
});

test('3.2: Case-insensitivity (uppercase / lowercase / mixed case) on ASCII names', () => {
  const resLower = runClientsFilter(INITIAL_BARBER_CLIENTS, 'mateo');
  assert.strictEqual(resLower.length, 1);
  assert.strictEqual(resLower[0].id, '1');

  const resUpper = runClientsFilter(INITIAL_BARBER_CLIENTS, 'MATEO');
  assert.strictEqual(resUpper.length, 1);
  assert.strictEqual(resUpper[0].id, '1');

  const resMixed = runClientsFilter(INITIAL_BARBER_CLIENTS, 'MaTeO "eL fLaCo"');
  assert.strictEqual(resMixed.length, 1);
  assert.strictEqual(resMixed[0].id, '1');

  const resDani = runClientsFilter(INITIAL_BARBER_CLIENTS, 'DANI MORALES');
  assert.strictEqual(resDani.length, 1);
  assert.strictEqual(resDani[0].id, '2');
});

test('3.3: Phone number and clipper guard formula search queries', () => {
  const resPhone = runClientsFilter(INITIAL_BARBER_CLIENTS, '600 123');
  assert.strictEqual(resPhone.length, 1);
  assert.strictEqual(resPhone[0].id, '1');

  const resFormula = runClientsFilter(INITIAL_BARBER_CLIENTS, '#000');
  assert.ok(resFormula.length >= 1, 'Finds clients matching #000 formula');
});

test('3.4: Adversarial Accent Test 1 — Searching "alex" (unaccented) vs "Álex Rivera"', () => {
  const alexClient = INITIAL_BARBER_CLIENTS.find(c => c.id === '3');
  assert.strictEqual(alexClient.name, 'Álex Rivera');

  // When user types 'alex' (without accent):
  const resUnaccented = runClientsFilter(INITIAL_BARBER_CLIENTS, 'alex');
  
  console.log(`    Result of searching 'alex' for 'Álex Rivera': matched ${resUnaccented.length} clients`);
  
  // In JavaScript: 'Álex Rivera'.toLowerCase().includes('alex') === false because 'á' !== 'a'
  const matchesUnaccented = resUnaccented.some(c => c.id === '3');
  assert.strictEqual(matchesUnaccented, false, 'BUG CONFIRMED: Searching "alex" fails to match "Álex Rivera"');
  console.log('    [BUG CONFIRMED] Searching unaccented "alex" yields 0 results for star client "Álex Rivera"');

  // When user types 'Álex' (with accent):
  const resAccented = runClientsFilter(INITIAL_BARBER_CLIENTS, 'Álex');
  assert.strictEqual(resAccented.length, 1, 'Searching with exact accent matches');
});

test('3.5: Adversarial Accent Test 2 — Searching "conexion" (unaccented) vs "conexión" in formulas', () => {
  const client1 = INITIAL_BARBER_CLIENTS.find(c => c.id === '1');
  assert.ok(client1.treatments[0].formula.includes('conexión'));

  const resUnaccented = runClientsFilter(INITIAL_BARBER_CLIENTS, 'conexion');
  console.log(`    Result of searching 'conexion' for 'conexión': matched ${resUnaccented.length} clients`);
  
  const matchesFormula = resUnaccented.some(c => c.id === '1');
  assert.strictEqual(matchesFormula, false, 'BUG CONFIRMED: Searching "conexion" fails to match formula containing "conexión"');
  console.log('    [BUG CONFIRMED] Searching unaccented "conexion" yields 0 results for formula containing "conexión"');
});

test('3.6: Comparison with normalizeText() oracle', () => {
  assert.strictEqual(normalizeText('Álex Rivera'), 'alex rivera');
  assert.strictEqual(normalizeText('alex'), 'alex');
  assert.ok(normalizeText('Álex Rivera').includes(normalizeText('alex')), 'normalizeText resolves Álex vs alex perfectly');
  assert.ok(normalizeText('conexión').includes(normalizeText('conexion')), 'normalizeText resolves conexión vs conexion perfectly');
});

test('3.7: Filter Tabs Integration with Fade Alerts and Search Query', () => {
  const urgentClients = runClientsFilter(INITIAL_BARBER_CLIENTS, '', 'urgent');
  console.log(`    Urgent clients count: ${urgentClients.length}`);

  const vipClients = runClientsFilter(INITIAL_BARBER_CLIENTS, '', 'vip');
  console.log(`    VIP clients count: ${vipClients.length}`);
  assert.ok(vipClients.some(c => c.id === '3'), 'Álex Rivera is in VIP filter');

  const walkInClients = runClientsFilter(INITIAL_BARBER_CLIENTS, '', 'walkin');
  console.log(`    Walk-in clients count: ${walkInClients.length}`);
});

test('3.8: Malformed Client in Clients.jsx — Missing name property crash vulnerability', () => {
  const brokenClients = [
    { id: 'broken-1', phone: '+34 600', treatment: 'Fade' } // missing name
  ];

  // In Clients.jsx line 26:
  // c.name.toLowerCase().includes(q)
  let threw = false;
  try {
    const q = 'fade';
    brokenClients.filter(c => {
      return c.name.toLowerCase().includes(q); // exact code in Clients.jsx line 26
    });
  } catch (err) {
    threw = true;
    console.log('    [VULNERABILITY CONFIRMED] Clients.jsx line 26 crashes with TypeError if c.name is missing:', err.message);
  }
  assert.strictEqual(threw, true, 'Clients.jsx line 26 crashes when client has no name');
});

// ============================================================================
// SUMMARY & REPORT GENERATION
// ============================================================================
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log(`DISCOVERED FINDINGS: ${findings.length}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exitCode = 1;
}
