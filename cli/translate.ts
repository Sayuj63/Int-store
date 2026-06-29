/**
 * Standalone CLI: translate a Shopify store using an Admin API access token.
 *
 * No Shopify CLI, no embedded admin, no OAuth, no tunnels. Just a script.
 *
 * Usage:
 *   SHOPIFY_STORE=intl-test-lkdfbex8.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_... \
 *   npx tsx cli/translate.ts --target fr
 *
 * Or put SHOPIFY_STORE + SHOPIFY_ADMIN_TOKEN in .env.cli and run:
 *   npx tsx cli/translate.ts --target fr
 */

import { readFileSync } from "node:fs";
import { runTranslation } from "../app/lib/shopify-translate.server";

function loadDotEnvCli() {
  try {
    const txt = readFileSync(new URL("../.env.cli", import.meta.url), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // file optional
  }
}
loadDotEnvCli();

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const target = args.target ?? process.env.TARGET_LOCALE;
const store = process.env.SHOPIFY_STORE;
const token = process.env.SHOPIFY_ADMIN_TOKEN;

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function die(msg: string): never {
  console.error(`${RED}error:${RESET} ${msg}`);
  process.exit(1);
}

if (!store) die("SHOPIFY_STORE not set (e.g. my-shop.myshopify.com)");
if (!token) die("SHOPIFY_ADMIN_TOKEN not set (Admin API token from custom app)");
if (!target) die("Missing --target <locale> (e.g. --target fr)");

const ADMIN_API_VERSION = "2025-10";
const endpoint = `https://${store}/admin/api/${ADMIN_API_VERSION}/graphql.json`;

// Thin client matching the shape runTranslation() expects: { graphql(query, {variables}) -> Response }
const admin = {
  async graphql(
    query: string,
    opts?: { variables?: Record<string, unknown> },
  ): Promise<Response> {
    return fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token!,
      },
      body: JSON.stringify({ query, variables: opts?.variables ?? {} }),
    });
  },
};

console.log(`${BOLD}${CYAN}Translation autopilot${RESET}`);
console.log(`${DIM}store:${RESET}  ${store}`);
console.log(`${DIM}target:${RESET} ${target}`);
console.log("");

const started = Date.now();
let lastTypeLogged = "";
const origLog = console.log;

try {
  const result = await runTranslation(admin, { targetLocale: target! });

  console.log("");
  console.log(
    `${BOLD}Done${RESET} — ${GREEN}${result.totalFieldsTranslated}${RESET} fields translated in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  console.log(
    `${DIM}source ${result.sourceLocale} → target ${result.targetLocale}${RESET}`,
  );
  console.log("");

  // Results table
  const header = `${BOLD}${"Resource type".padEnd(38)}${"Scanned".padStart(8)}${"Translated".padStart(12)}${"Skipped".padStart(10)}${"Errors".padStart(8)}${RESET}`;
  console.log(header);
  console.log(DIM + "─".repeat(76) + RESET);
  for (const r of result.perType) {
    const errColor = r.errors.length ? RED : DIM;
    console.log(
      `${r.resourceType.padEnd(38)}${String(r.resourcesScanned).padStart(8)}${GREEN}${String(r.fieldsTranslated).padStart(12)}${RESET}${YELLOW}${String(r.fieldsSkipped).padStart(10)}${RESET}${errColor}${String(r.errors.length).padStart(8)}${RESET}`,
    );
  }

  // Sample translations
  const samples = result.perType.flatMap((r) =>
    r.samples.map((s) => ({ ...s, resourceType: r.resourceType })),
  );
  if (samples.length) {
    console.log("");
    console.log(`${BOLD}Sample translations${RESET}`);
    console.log(DIM + "─".repeat(76) + RESET);
    for (const s of samples.slice(0, 8)) {
      console.log(
        `${CYAN}${s.resourceType}${RESET} · ${DIM}${s.key}${RESET}`,
      );
      console.log(`  ${DIM}${result.sourceLocale}:${RESET} ${s.original.slice(0, 120)}`);
      console.log(`  ${DIM}${result.targetLocale}:${RESET} ${s.translated.slice(0, 120)}`);
      console.log("");
    }
  }

  // Errors
  const allErrors = result.perType.flatMap((r) =>
    r.errors.map((e) => `${r.resourceType}: ${e}`),
  );
  if (allErrors.length) {
    console.log(`${RED}${BOLD}Errors:${RESET}`);
    for (const e of allErrors.slice(0, 10)) console.log(`  ${RED}•${RESET} ${e}`);
    if (allErrors.length > 10) console.log(`  ${DIM}…and ${allErrors.length - 10} more${RESET}`);
  }

  console.log("");
  console.log(
    `${DIM}Verify in admin → Translate & Adapt, or open storefront and switch language.${RESET}`,
  );
} catch (err) {
  die(err instanceof Error ? err.message : String(err));
}
