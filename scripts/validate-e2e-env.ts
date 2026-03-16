#!/usr/bin/env tsx
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env' });
dotenvConfig({ path: '.env.local', override: true });

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

interface ValidationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
}

const results: ValidationResult[] = [];

function log(check: string, status: ValidationResult['status'], message: string) {
  results.push({ check, status, message });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '○';
  console.log(`[${icon}] ${check}: ${message}`);
}

async function validateEnvironment() {
  console.log('========================================');
  console.log('E2E Environment Validation (T032)');
  console.log('========================================\n');

  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  if (major >= 18) {
    log('Node.js Version', 'PASS', `${version} (>= 18)`);
  } else {
    log('Node.js Version', 'FAIL', `${version} (requires >= 18)`);
  }

  try {
    const playwrightPath = resolve(process.cwd(), 'node_modules', '@playwright', 'test');
    if (existsSync(playwrightPath)) {
      log('Playwright Package', 'PASS', '@playwright/test installed');
    } else {
      log('Playwright Package', 'FAIL', '@playwright/test not found');
    }
  } catch (err) {
    log('Playwright Package', 'FAIL', 'Error checking installation');
  }

  try {
    execSync('npx playwright chromium --version', { stdio: 'pipe' });
    log('Playwright Browsers', 'PASS', 'Chromium browser available');
  } catch (err) {
    log('Playwright Browsers', 'FAIL', 'Chromium not installed. Run: npx playwright install chromium');
  }

  const envLocalPath = resolve(process.cwd(), '.env.local');
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envLocalPath) || existsSync(envPath)) {
    log('Environment File', 'PASS', '.env.local or .env exists');
  } else {
    log('Environment File', 'FAIL', 'No .env or .env.local found');
  }

  if (process.env.CLERK_SECRET_KEY) {
    log('CLERK_SECRET_KEY', 'PASS', 'Environment variable set');
  } else {
    log('CLERK_SECRET_KEY', 'FAIL', 'Not set in environment');
  }

  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    log('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'PASS', 'Environment variable set');
  } else {
    log('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'FAIL', 'Not set in environment');
  }

  if (process.env.DATABASE_URL) {
    log('DATABASE_URL', 'PASS', 'Environment variable set');
  } else {
    log('DATABASE_URL', 'FAIL', 'Not set in environment');
  }

  try {
    execSync('curl -s http://localhost:3000 > /dev/null', { timeout: 5000 });
    log('Local Dev Server', 'PASS', 'Running on http://localhost:3000');
  } catch (err) {
    log('Local Dev Server', 'FAIL', 'Not running on http://localhost:3000. Start with: npm run dev');
  }

  const cleanupScript = resolve(process.cwd(), 'scripts', 'cleanup-e2e.ts');
  if (existsSync(cleanupScript)) {
    log('Cleanup Script', 'PASS', 'scripts/cleanup-e2e.ts exists');
  } else {
    log('Cleanup Script', 'FAIL', 'scripts/cleanup-e2e.ts not found');
  }

  const multiScorerTest = resolve(process.cwd(), 'tests', 'e2e', 'multi-scorer.spec.ts');
  const rolesTest = resolve(process.cwd(), 'tests', 'e2e', 'roles.spec.ts');
  
  if (existsSync(multiScorerTest)) {
    log('Multi-Scorer Test', 'PASS', 'tests/e2e/multi-scorer.spec.ts exists');
  } else {
    log('Multi-Scorer Test', 'FAIL', 'tests/e2e/multi-scorer.spec.ts not found');
  }

  if (existsSync(rolesTest)) {
    log('Roles Test', 'PASS', 'tests/e2e/roles.spec.ts exists');
  } else {
    log('Roles Test', 'FAIL', 'tests/e2e/roles.spec.ts not found');
  }

  const pwConfig = resolve(process.cwd(), 'playwright.config.ts');
  if (existsSync(pwConfig)) {
    log('Playwright Config', 'PASS', 'playwright.config.ts exists');
  } else {
    log('Playwright Config', 'FAIL', 'playwright.config.ts not found');
  }

  console.log('\n========================================');
  console.log('Validation Summary');
  console.log('========================================');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`Total: ${results.length} checks`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some checks failed. Fix the issues above before running E2E tests.');
    console.log('   See specs/003-multi-scorer-e2e/quickstart.md for setup instructions.');
    process.exit(1);
  } else {
    console.log('\n✓ Environment is ready for E2E testing!');
    console.log('  Run: npm run test:e2e');
    process.exit(0);
  }
}

validateEnvironment().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
