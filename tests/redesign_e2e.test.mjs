#!/usr/bin/env node

/**
 * KUTZ // BARBER OS Redesign — 4-Tier E2E Master Suite (Requirements R1–R5)
 * Standalone Opaque-Box E2E Runner
 *
 * Tier 1: Primary Feature Coverage (70 tests across Features 1–14)
 * Tier 2: Boundary & Corner Cases (70 tests across Domains 1–14)
 * Tier 3: Cross-Feature Interactions (15 Pairwise System Tests)
 * Tier 4: Real-World Barbershop Workloads (5 End-to-End User Workflows)
 * Total: 160 Rigorous Executable Tests
 */

import { TestRunner } from './helpers/testHarness.mjs';
import { registerRedesignTier1Tests } from './redesign_tier1.mjs';
import { registerRedesignTier2Tests } from './redesign_tier2.mjs';
import { registerRedesignTier3Tests } from './redesign_tier3.mjs';
import { registerRedesignTier4Tests } from './redesign_tier4.mjs';

export function registerAllRedesignSuites(runner) {
  registerRedesignTier1Tests(runner);
  registerRedesignTier2Tests(runner);
  registerRedesignTier3Tests(runner);
  registerRedesignTier4Tests(runner);
}

export async function runRedesignE2ESuite() {
  const runner = new TestRunner('KUTZ // BARBER OS Redesign — 4-Tier E2E Master Suite (R1–R5)');

  console.log('\x1b[36mInitializing KUTZ // BARBER OS Redesign E2E Test Suite...\x1b[0m');
  registerAllRedesignSuites(runner);

  const result = await runner.execute();

  if (!result.success) {
    console.error(`\x1b[31m[REDESIGN TEST SUITE FAILURE]\x1b[0m ${result.totalFailed} test(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\x1b[32m[REDESIGN TEST SUITE SUCCESS]\x1b[0m All ${result.totalPassed} tests passed successfully across all 4 tiers!`);
    process.exitCode = 0;
  }

  return result;
}

// Direct execution guard
const isDirectRun = process.argv[1] && process.argv[1].endsWith('redesign_e2e.test.mjs');
if (isDirectRun) {
  runRedesignE2ESuite().catch(err => {
    console.error('Fatal redesign test execution error:', err);
    process.exit(1);
  });
}
