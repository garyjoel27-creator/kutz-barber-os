import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Read ClientContext.jsx source code
const clientContextPath = path.resolve(__dirname, '../src/context/ClientContext.jsx');
const clientContextSource = fs.readFileSync(clientContextPath, 'utf8');

// 2. Extract pure logic functions (normalizeText, parseTreatmentDate, calculateRetentionInsights)
// We isolate the functions up to ClientProvider to execute pure JS without JSX dependencies
const codeToExecute = clientContextSource
  .replace(/import\s+React[^;]+;/g, '')
  .replace(/const\s+ClientContext\s+=[^;]+;/g, '')
  .replace(/export\s+const\s+useClients\s+=[^;]+;/g, '')
  .replace(/export\s+const\s+ClientProvider\s+=[^]*$/g, '')
  .replace(/export\s+function\s+/g, 'function ');

const sandbox = {
  Date,
  Math,
  String,
  Number,
  parseInt,
  isNaN,
  Array,
  console
};

vm.createContext(sandbox);
vm.runInContext(codeToExecute + `
  globalThis.normalizeText = normalizeText;
  globalThis.parseTreatmentDate = parseTreatmentDate;
  globalThis.calculateRetentionInsights = calculateRetentionInsights;
`, sandbox);

const { normalizeText, parseTreatmentDate, calculateRetentionInsights } = sandbox.globalThis;

console.log('===============================================================');
console.log('LuminaDesk M2 Retention Engine — Empirical Adversarial Suite');
console.log('Testing pure functions directly extracted from ClientContext.jsx');
console.log('===============================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${testName}${details ? ' - ' + details : ''}`);
    failures.push({ testName, details });
  }
}

// -------------------------------------------------------------
// SECTION 1: normalizeText tests
// -------------------------------------------------------------
console.log('--- Suite 1: normalizeText ---');
assert(normalizeText(null) === '', 'normalizeText handles null gracefully');
assert(normalizeText(undefined) === '', 'normalizeText handles undefined gracefully');
assert(normalizeText('') === '', 'normalizeText handles empty string');
assert(normalizeText('  Botox  ') === 'botox', 'normalizeText trims and lowercases');
assert(
  normalizeText('Ácido Hialurónico en Pómulos') === 'acido hialuronico en pomulos',
  'normalizeText removes diacritics and accents'
);
assert(
  normalizeText('TÓXINA BOTULÍNICA') === 'toxina botulinica',
  'normalizeText handles uppercase accents'
);

// -------------------------------------------------------------
// SECTION 2: parseTreatmentDate tests
// -------------------------------------------------------------
console.log('\n--- Suite 2: parseTreatmentDate ---');

// Null and undefined
const nullDate = parseTreatmentDate(null);
assert(nullDate instanceof Date && !isNaN(nullDate.getTime()), 'parseTreatmentDate handles null gracefully');

const undefinedDate = parseTreatmentDate(undefined);
assert(undefinedDate instanceof Date && !isNaN(undefinedDate.getTime()), 'parseTreatmentDate handles undefined gracefully');

// Invalid date strings
const invalidDate = parseTreatmentDate('not-a-real-date');
assert(invalidDate instanceof Date && !isNaN(invalidDate.getTime()), 'parseTreatmentDate handles invalid string gracefully');

// Numeric timestamps
const numTimestamp = 1727740800000; // 2024-10-01T00:00:00.000Z
const parsedNum = parseTreatmentDate(numTimestamp);
assert(parsedNum.getTime() === numTimestamp, 'parseTreatmentDate parses number timestamp');

// Numeric timestamp string
const strTimestamp = '1727740800000';
const parsedStrNum = parseTreatmentDate(strTimestamp);
assert(parsedStrNum.getTime() === numTimestamp, 'parseTreatmentDate parses stringified numeric timestamp');

// Secondary parameter timestampValue precedence
const parsedFromParam = parseTreatmentDate('invalid-string', numTimestamp);
assert(parsedFromParam.getTime() === numTimestamp, 'parseTreatmentDate prioritizes timestampValue over dateValue');

// ISO strings
const isoString = '2026-05-15';
const parsedIso = parseTreatmentDate(isoString);
assert(parsedIso.getFullYear() === 2026 && parsedIso.getMonth() === 4 && parsedIso.getDate() === 15, 'parseTreatmentDate parses ISO YYYY-MM-DD');

// Spanish date strings: '15 Ene 2026', '20 Mar 2025', '12 Oct 2026'
const spEne = parseTreatmentDate('15 Ene 2026');
assert(spEne.getFullYear() === 2026 && spEne.getMonth() === 0 && spEne.getDate() === 15, 'parseTreatmentDate parses "15 Ene 2026"');

const spMar = parseTreatmentDate('20 Mar 2025');
assert(spMar.getFullYear() === 2025 && spMar.getMonth() === 2 && spMar.getDate() === 20, 'parseTreatmentDate parses "20 Mar 2025"');

const spOct = parseTreatmentDate('12 Oct 2026');
assert(spOct.getFullYear() === 2026 && spOct.getMonth() === 9 && spOct.getDate() === 12, 'parseTreatmentDate parses "12 Oct 2026"');

const spMayoDe = parseTreatmentDate('15 de mayo de 2026');
assert(spMayoDe.getFullYear() === 2026 && spMayoDe.getMonth() === 4 && spMayoDe.getDate() === 15, 'parseTreatmentDate parses "15 de mayo de 2026"');

const spSep = parseTreatmentDate('23 sep 2026');
assert(spSep.getFullYear() === 2026 && spSep.getMonth() === 8 && spSep.getDate() === 23, 'parseTreatmentDate parses "23 sep 2026"');

// -------------------------------------------------------------
// SECTION 3: Robustness & Empty / Null Clients
// -------------------------------------------------------------
console.log('\n--- Suite 3: Client Robustness ---');

assert(Array.isArray(calculateRetentionInsights(null)) && calculateRetentionInsights(null).length === 0, 'null client returns empty array');
assert(Array.isArray(calculateRetentionInsights(undefined)) && calculateRetentionInsights(undefined).length === 0, 'undefined client returns empty array');

const clientNoTreatments = { id: 'c1', name: 'Test Client', treatments: [] };
const resNoTreatments = calculateRetentionInsights(clientNoTreatments);
assert(Array.isArray(resNoTreatments) && resNoTreatments.length === 0, 'client with empty treatments array returns empty array');

const clientNullTreatments = { id: 'c2', name: 'Test Client', treatments: null };
const resNullTreatments = calculateRetentionInsights(clientNullTreatments);
assert(Array.isArray(resNullTreatments) && resNullTreatments.length === 0, 'client with null treatments returns empty array');

const clientUndefinedTreatments = { id: 'c3', name: 'Test Client' };
const resUndefinedTreatments = calculateRetentionInsights(clientUndefinedTreatments);
assert(Array.isArray(resUndefinedTreatments) && resUndefinedTreatments.length === 0, 'client with missing treatments property returns empty array');

// -------------------------------------------------------------
// SECTION 4: Botox Retention Boundaries (Threshold: 90 days, Urgency High: 120 days)
// Reference date: 2026-10-01T00:00:00.000Z
// -------------------------------------------------------------
console.log('\n--- Suite 4: Botox Retention Boundaries ---');

const REF_DATE = new Date('2026-10-01T00:00:00.000Z').getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

function createBotoxClient(daysAgo) {
  const treatmentTimestamp = REF_DATE - (daysAgo * DAY_MS);
  const treatmentDateObj = new Date(treatmentTimestamp);
  const isoDate = treatmentDateObj.toISOString().split('T')[0];
  return {
    id: `botox-${daysAgo}`,
    name: `Botox Patient ${daysAgo}d`,
    phone: '+34600111222',
    treatments: [
      {
        id: `t-botox-${daysAgo}`,
        name: 'Toxina Botulínica Frente',
        date: isoDate,
        timestamp: treatmentTimestamp,
        notes: 'Protocolo regular tercio superior'
      }
    ]
  };
}

// 89 days: 0 insights
const client89 = createBotoxClient(89);
const insights89 = calculateRetentionInsights(client89, REF_DATE);
assert(insights89.length === 0, 'Botox 89 days: exactly 0 insights (below 90 threshold)');

// 90 days: 1 insight, urgency 'upcoming', thresholdDays 90
const client90 = createBotoxClient(90);
const insights90 = calculateRetentionInsights(client90, REF_DATE);
assert(insights90.length === 1, 'Botox 90 days: generates 1 insight');
assert(insights90[0]?.type === 'botox', 'Botox 90 days: type is "botox"');
assert(insights90[0]?.urgency === 'upcoming', `Botox 90 days: urgency is "upcoming" (got "${insights90[0]?.urgency}")`);
assert(insights90[0]?.thresholdDays === 90, 'Botox 90 days: thresholdDays is 90');
assert(insights90[0]?.elapsedDays === 90, `Botox 90 days: elapsedDays is 90 (got ${insights90[0]?.elapsedDays})`);

// 119 days: 1 insight, urgency 'upcoming'
const client119 = createBotoxClient(119);
const insights119 = calculateRetentionInsights(client119, REF_DATE);
assert(insights119.length === 1, 'Botox 119 days: generates 1 insight');
assert(insights119[0]?.urgency === 'upcoming', `Botox 119 days: urgency is "upcoming" (got "${insights119[0]?.urgency}")`);
assert(insights119[0]?.elapsedDays === 119, `Botox 119 days: elapsedDays is 119 (got ${insights119[0]?.elapsedDays})`);

// 120 days: 1 insight, urgency 'high'
const client120 = createBotoxClient(120);
const insights120 = calculateRetentionInsights(client120, REF_DATE);
assert(insights120.length === 1, 'Botox 120 days: generates 1 insight');
assert(insights120[0]?.urgency === 'high', `Botox 120 days: urgency is "high" (got "${insights120[0]?.urgency}")`);
assert(insights120[0]?.statusLabel === 'Retoque Prioritario', 'Botox 120 days: statusLabel is "Retoque Prioritario"');
assert(insights120[0]?.elapsedDays === 120, `Botox 120 days: elapsedDays is 120 (got ${insights120[0]?.elapsedDays})`);

// 150 days: 1 insight, urgency 'high'
const client150 = createBotoxClient(150);
const insights150 = calculateRetentionInsights(client150, REF_DATE);
assert(insights150.length === 1, 'Botox 150 days: generates 1 insight');
assert(insights150[0]?.urgency === 'high', `Botox 150 days: urgency is "high" (got "${insights150[0]?.urgency}")`);
assert(insights150[0]?.elapsedDays === 150, `Botox 150 days: elapsedDays is 150 (got ${insights150[0]?.elapsedDays})`);

// -------------------------------------------------------------
// SECTION 5: Dermal Filler Retention Boundaries (Threshold: 270 days, Urgency High: 365 days)
// -------------------------------------------------------------
console.log('\n--- Suite 5: Dermal Filler Retention Boundaries ---');

function createFillerClient(daysAgo) {
  const treatmentTimestamp = REF_DATE - (daysAgo * DAY_MS);
  const treatmentDateObj = new Date(treatmentTimestamp);
  const isoDate = treatmentDateObj.toISOString().split('T')[0];
  return {
    id: `filler-${daysAgo}`,
    name: `Filler Patient ${daysAgo}d`,
    phone: '+34600333444',
    treatments: [
      {
        id: `t-filler-${daysAgo}`,
        name: 'Relleno de Labios Ácido Hialurónico',
        date: isoDate,
        timestamp: treatmentTimestamp,
        notes: 'Definición del arco de cupido e hidratación'
      }
    ]
  };
}

// 269 days: 0 insights
const client269 = createFillerClient(269);
const insights269 = calculateRetentionInsights(client269, REF_DATE);
assert(insights269.length === 0, 'Filler 269 days: exactly 0 insights (below 270 threshold)');

// 270 days: 1 insight, urgency 'upcoming', thresholdDays 270
const client270 = createFillerClient(270);
const insights270 = calculateRetentionInsights(client270, REF_DATE);
assert(insights270.length === 1, 'Filler 270 days: generates 1 insight');
assert(insights270[0]?.type === 'filler', 'Filler 270 days: type is "filler"');
assert(insights270[0]?.urgency === 'upcoming', `Filler 270 days: urgency is "upcoming" (got "${insights270[0]?.urgency}")`);
assert(insights270[0]?.thresholdDays === 270, 'Filler 270 days: thresholdDays is 270');
assert(insights270[0]?.elapsedDays === 270, `Filler 270 days: elapsedDays is 270 (got ${insights270[0]?.elapsedDays})`);

// 364 days: 1 insight, urgency 'upcoming'
const client364 = createFillerClient(364);
const insights364 = calculateRetentionInsights(client364, REF_DATE);
assert(insights364.length === 1, 'Filler 364 days: generates 1 insight');
assert(insights364[0]?.urgency === 'upcoming', `Filler 364 days: urgency is "upcoming" (got "${insights364[0]?.urgency}")`);
assert(insights364[0]?.elapsedDays === 364, `Filler 364 days: elapsedDays is 364 (got ${insights364[0]?.elapsedDays})`);

// 365 days: 1 insight, urgency 'high'
const client365 = createFillerClient(365);
const insights365 = calculateRetentionInsights(client365, REF_DATE);
assert(insights365.length === 1, 'Filler 365 days: generates 1 insight');
assert(insights365[0]?.urgency === 'high', `Filler 365 days: urgency is "high" (got "${insights365[0]?.urgency}")`);
assert(insights365[0]?.statusLabel === 'Retoque Prioritario', 'Filler 365 days: statusLabel is "Retoque Prioritario"');
assert(insights365[0]?.elapsedDays === 365, `Filler 365 days: elapsedDays is 365 (got ${insights365[0]?.elapsedDays})`);

// -------------------------------------------------------------
// SECTION 6: Multi-Treatment Patient — Most Recent vs Oldest
// -------------------------------------------------------------
console.log('\n--- Suite 6: Multi-treatment Sorting & Most Recent Selection ---');

const multiBotoxClient = {
  id: 'c-multi-botox',
  name: 'Valentina Morales',
  treatments: [
    {
      id: 't-oldest',
      name: 'Botox Completo',
      date: new Date(REF_DATE - (400 * DAY_MS)).toISOString().split('T')[0],
      timestamp: REF_DATE - (400 * DAY_MS),
      notes: 'Sesión hace 400 días'
    },
    {
      id: 't-middle',
      name: 'Botox Retoque Entrecejo',
      date: new Date(REF_DATE - (200 * DAY_MS)).toISOString().split('T')[0],
      timestamp: REF_DATE - (200 * DAY_MS),
      notes: 'Sesión hace 200 días'
    },
    {
      id: 't-latest',
      name: 'Toxina Botulínica Preventiva',
      date: new Date(REF_DATE - (95 * DAY_MS)).toISOString().split('T')[0],
      timestamp: REF_DATE - (95 * DAY_MS),
      notes: 'Sesión hace 95 días'
    }
  ]
};

const multiBotoxInsights = calculateRetentionInsights(multiBotoxClient, REF_DATE);
assert(multiBotoxInsights.length === 1, 'Multi-botox client produces exactly 1 aggregated Botox insight');
assert(multiBotoxInsights[0]?.elapsedDays === 95, `Calculates from MOST RECENT (95d), got ${multiBotoxInsights[0]?.elapsedDays}d (NOT 400d or 200d)`);
assert(multiBotoxInsights[0]?.urgency === 'upcoming', `Urgency based on 95d is "upcoming", got "${multiBotoxInsights[0]?.urgency}"`);
assert(multiBotoxInsights[0]?.treatmentName === 'Toxina Botulínica Preventiva', `Selected treatment name is most recent ("${multiBotoxInsights[0]?.treatmentName}")`);

// Another multi-treatment test: Latest is NOT due (< 90 days), but older ones are due
const multiBotoxRecentlyTreated = {
  id: 'c-recent-botox',
  name: 'Camila Reyes',
  treatments: [
    {
      id: 't-old',
      name: 'Botox Frente',
      date: new Date(REF_DATE - (300 * DAY_MS)).toISOString().split('T')[0],
      timestamp: REF_DATE - (300 * DAY_MS)
    },
    {
      id: 't-recent',
      name: 'Botox Retoque',
      date: new Date(REF_DATE - (30 * DAY_MS)).toISOString().split('T')[0],
      timestamp: REF_DATE - (30 * DAY_MS)
    }
  ]
};

const recentInsights = calculateRetentionInsights(multiBotoxRecentlyTreated, REF_DATE);
assert(recentInsights.length === 0, 'Multi-botox client with recent touch-up (30d) triggers 0 insights even with old treatments');

// -------------------------------------------------------------
// SECTION 7: Dual Treatment Client (Botox + Filler) & Priority Sorting
// -------------------------------------------------------------
console.log('\n--- Suite 7: Dual Category Patient (Botox + Filler) ---');

const dualClient = {
  id: 'c-dual',
  name: 'Lucia Méndez',
  phone: '+34 655 444 333',
  treatments: [
    {
      id: 't-botox-high',
      name: 'Toxina Botulínica Vistabel',
      date: new Date(REF_DATE - (130 * DAY_MS)).toISOString().split('T')[0],
      timestamp: REF_DATE - (130 * DAY_MS)
    },
    {
      id: 't-filler-upcoming',
      name: 'Relleno de Pómulos Ácido Hialurónico',
      date: new Date(REF_DATE - (280 * DAY_MS)).toISOString().split('T')[0],
      timestamp: REF_DATE - (280 * DAY_MS)
    }
  ]
};

const dualInsights = calculateRetentionInsights(dualClient, REF_DATE);
assert(dualInsights.length === 2, 'Dual client produces 2 insights (1 botox, 1 filler)');
assert(dualInsights[0]?.type === 'botox' && dualInsights[0]?.urgency === 'high', 'First insight is high-urgency Botox (130d)');
assert(dualInsights[1]?.type === 'filler' && dualInsights[1]?.urgency === 'upcoming', 'Second insight is upcoming Filler (280d)');
assert(dualInsights[0]?.whatsappDraft.includes('Lucia Méndez'), 'WhatsApp draft contains personalized client name');
assert(dualInsights[0]?.suggestedAction === 'Agendar Retoque Botox', 'suggestedAction is properly labeled');
assert(dualInsights[1]?.suggestedAction === 'Agendar Retoque Relleno', 'suggestedAction for filler is properly labeled');

// -------------------------------------------------------------
// SECTION 8: Unrecognized treatments
// -------------------------------------------------------------
console.log('\n--- Suite 8: Unrecognized Treatment Categories ---');

const nonRetentiveClient = {
  id: 'c-other',
  name: 'Javier Santos',
  treatments: [
    {
      id: 't-peeling',
      name: 'Peeling Químico Glicólico',
      date: new Date(REF_DATE - (150 * DAY_MS)).toISOString().split('T')[0],
      timestamp: REF_DATE - (150 * DAY_MS)
    },
    {
      id: 't-laser',
      name: 'Láser Diodo Piernas Completas',
      date: new Date(REF_DATE - (400 * DAY_MS)).toISOString().split('T')[0],
      timestamp: REF_DATE - (400 * DAY_MS)
    }
  ]
};

const nonRetentiveInsights = calculateRetentionInsights(nonRetentiveClient, REF_DATE);
assert(nonRetentiveInsights.length === 0, 'Unrelated treatments produce 0 false retention alerts');

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n===============================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('===============================================================');

if (failedTests > 0) {
  console.error('\nFailures summary:');
  failures.forEach(f => console.error(`  - ${f.testName}: ${f.details}`));
  process.exitCode = 1;
} else {
  console.log('\nALL ADVERSARIAL RETENTION ENGINE TESTS PASSED PERFECTLY!');
  process.exitCode = 0;
}
