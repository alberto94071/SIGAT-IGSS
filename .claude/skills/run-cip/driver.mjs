#!/usr/bin/env node
/**
 * CIP smoke-test driver — uses Playwright Chromium
 *
 * Usage:
 *   node .claude/skills/run-cip/driver.mjs [--screenshot] [--url http://localhost:3000]
 *
 * Requires: npx playwright install chromium (one-time)
 * Server must already be running (npm run dev  or  npm start).
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.CIP_URL || "http://localhost:3000";
const SCREENSHOT = process.argv.includes("--screenshot");
const SS_DIR = ".claude/skills/run-cip/screenshots";
const CREDS = {
  email: process.env.CIP_EMAIL,
  password: process.env.CIP_PASSWORD,
};
if (!CREDS.email || !CREDS.password) {
  console.error("Set CIP_EMAIL and CIP_PASSWORD env vars before running.");
  process.exit(1);
}

if (SCREENSHOT) mkdirSync(SS_DIR, { recursive: true });

function ss(page, name) {
  if (!SCREENSHOT) return;
  const path = join(SS_DIR, `${name}.png`);
  return page.screenshot({ path, fullPage: false });
}

async function main() {
  // Use system Edge if Playwright's bundled Chromium isn't downloaded yet
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const browser = await chromium.launch({
    headless: true,
    executablePath: edgePath,
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  console.log("→ /login");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  const title = await page.title();
  console.log(`   title: ${title}`);
  await ss(page, "01-login");

  // Fill login form
  await page.fill('input[type="email"]', CREDS.email);
  await page.fill('input[type="password"]', CREDS.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10_000 });
  console.log("→ /dashboard (login OK)");
  await ss(page, "02-dashboard");

  // Navigate to launcher
  await page.goto(`${BASE_URL}/launcher`, { waitUntil: "networkidle" });
  console.log("→ /launcher");
  await ss(page, "03-launcher");

  // Navigate to compras
  await page.goto(`${BASE_URL}/compras`, { waitUntil: "networkidle" });
  console.log("→ /compras");
  await ss(page, "04-compras");

  await browser.close();
  console.log("✓ smoke test passed");
  if (SCREENSHOT) console.log(`  screenshots → ${SS_DIR}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
