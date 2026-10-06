// Shared helpers for the UI demo/verification scripts (Phase 25.0): one attach, one run lock, UI-state waits, timed steps.
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(new URL("../../node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/", import.meta.url).pathname);
export const { chromium } = require("./index.js");

export const BASE = process.env.DEMO_BASE ?? "https://donordesk.online";
const CDP = process.env.DEMO_CDP ?? "http://localhost:9333";
const LOCK = "/tmp/donordesk-demo-ui.lock";

/**
 * A single-flight lock: two scripts driving the same browser page collided twice in demo 5. The lock holds the pid of
 * the script that owns the page; a stale lock (its process is gone) is taken over.
 */
export function acquireRunLock(name) {
  if (fs.existsSync(LOCK)) {
    const [pid, owner] = fs.readFileSync(LOCK, "utf8").split(" ");
    let alive = false;
    try { process.kill(Number(pid), 0); alive = true; } catch { /* gone */ }
    if (alive) throw new Error(`The browser page is in use by "${owner}" (pid ${pid}). Wait for it, or stop it first.`);
  }
  fs.writeFileSync(LOCK, `${process.pid} ${name}`);
  const release = () => { try { if (fs.readFileSync(LOCK, "utf8").startsWith(`${process.pid} `)) fs.unlinkSync(LOCK); } catch { /* already gone */ } };
  process.on("exit", release);
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { release(); process.exit(130); });
  return release;
}

export async function attach(name = "script") {
  acquireRunLock(name);
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const goto = page.goto.bind(page);
  page.goto = async (url, options) => {
    for (let i = 0; i < 4; i += 1) {
      try { return await goto(url, options); } catch (error) { if (i === 3) throw error; await new Promise((r) => setTimeout(r, 2500)); }
    }
  };
  return { browser, ctx, page };
}

/** Waits for something visible in the UI, never a fixed sleep; throws with what was being waited for. */
export async function waitForUi(page, predicate, { timeout = 30000, what = "the page to change" } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await predicate()) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`Timed out after ${timeout} ms waiting for ${what}`);
}

/** Runs one named step, logging its duration; a failure names the step and stops the run. */
export async function step(name, work, { results } = {}) {
  const started = Date.now();
  try {
    const value = await work();
    const ms = Date.now() - started;
    console.log(`  ok   ${name} (${ms} ms)`);
    results?.push({ name, ok: true, ms });
    return value;
  } catch (error) {
    console.log(`  FAIL ${name}: ${String(error).split("\n")[0]}`);
    results?.push({ name, ok: false, error: String(error) });
    throw error;
  }
}

export const text = async (page, selector = "main") => (await page.locator(selector).innerText()).replace(/\n+/g, " | ");

/** Lists the visible controls of the page (tag | type | name | label | text | href | value): to find what a form asks for. */
export async function dump(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll("main input,main select,main textarea,main button,main a[href],form input,form button").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const id = e.id;
      const label = id ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() : e.closest("label")?.textContent?.trim();
      out.push([e.tagName.toLowerCase(), e.type ?? "", e.name ?? "", label ?? e.getAttribute("aria-label") ?? "", (e.textContent ?? "").trim().slice(0, 60), e.getAttribute("href") ?? "", e.value?.slice?.(0, 30) ?? ""].join(" | "));
    });
    return out;
  });
}
