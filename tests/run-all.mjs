#!/usr/bin/env node

import { TestRunner } from './helpers/testHarness.mjs';
import { registerAllRedesignSuites } from './redesign_e2e.test.mjs';
import { registerTier1Tests } from './tier1_features.test.mjs';
import { registerTier2Tests } from './tier2_boundaries.test.mjs';
import { registerTier3Tests } from './tier3_interactions.test.mjs';
import { registerTier4Tests } from './tier4_workloads.test.mjs';
import { registerAllBookingEngineSuites } from './e2e_booking_engine.test.mjs';
import { registerSyncServiceTests } from './syncService.test.mjs';
import { registerEmpiricalSuites } from './empirical_m1_challenger2.test.mjs';
import { registerChallenger1EmpiricalSuites } from './challenger_m1_empirical.test.mjs';
import { registerM2MultiShopTests } from './m2_multishop_superadmin.test.mjs';
import { registerPilar1To6VerificationTests } from './pilar1_6_verification.test.mjs';

async function main() {
  const runner = new TestRunner('KUTZ // BARBER OS & LuminaDesk Master E2E Suite');

  console.log('Loading KUTZ // BARBER OS Redesign E2E suites (Tiers 1–4)...');
  registerAllRedesignSuites(runner);

  console.log('Loading baseline clinical suites (Tiers 1–4)...');
  registerTier1Tests(runner);
  registerTier2Tests(runner);
  registerTier3Tests(runner);
  registerTier4Tests(runner);

  console.log('Loading QR Booking Engine & Multi-Shop suites (Tiers 1–4)...');
  registerAllBookingEngineSuites(runner);

  console.log('Loading Milestone 1 Backend & Blobs Sync Engine suites...');
  registerSyncServiceTests(runner);

  console.log('Loading Milestone 1 Empirical Challenger 2 Stress Suites...');
  registerEmpiricalSuites(runner);

  console.log('Loading Milestone 1 Empirical Challenger 1 Concurrency & Security Suites...');
  registerChallenger1EmpiricalSuites(runner);

  console.log('Loading Milestone 2 Multi-Shop Architecture & Super-Admin Suites...');
  registerM2MultiShopTests(runner);

  console.log('Loading Pillars 1–5 Real Handlers, Multi-Tenant & Interval Booking Verification Suites...');
  registerPilar1To6VerificationTests(runner);

  const result = await runner.execute();

  if (!result.success) {
    console.error(`\x1b[31m[TEST SUITE FAILURE]\x1b[0m ${result.totalFailed} test(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\x1b[32m[TEST SUITE SUCCESS]\x1b[0m All ${result.totalPassed} tests passed successfully across all suites!`);
    process.exitCode = 0;
  }

  return result;
}

main().catch(err => {
  console.error('Fatal test runner execution error:', err);
  process.exit(1);
});
