# Claude context — intl-translator-cli

> This file is auto-loaded by Claude Code when you open `~/Desktop/intl-app`.
> It tells future Claude sessions what this project is, what's built, and
> what's left, so you don't have to re-explain.

## What this is

A standalone Node CLI that bulk-translates a Shopify store using a Custom App
Admin API token. **No OAuth, no tunnels, no embedded admin** — just a script
that talks to Shopify's Admin GraphQL API and writes translations via
`translationsRegister`. Output lands in Shopify's native "Translate & Adapt"
panel so the merchant can review/edit/override.

**Built by:** Sayuj, June 2026, for an office demo.
**GitHub:** https://github.com/Sayuj63/Int-store

## Why CLI (not embedded admin app)

We initially tried the full Shopify React Router 7 embedded admin app route.
Spent hours fighting CLI 4.x quirks: placeholder application_url, broken
localhost proxy, cloudflared host blocks, missing env vars after `app env pull`,
webhook deploy failures. Pivoted to Custom App + standalone CLI because
**user wanted a working demo today, not next week**.

The React Router scaffold is still in `app/routes/` and `app/lib/` so we can
revive the embedded UI for Phase 1 of the roadmap. The CLI reuses
`app/lib/translator.server.ts` and `app/lib/shopify-translate.server.ts`
unchanged — those modules are framework-agnostic.

## How to run

```bash
# one-time setup
cp .env.cli.example .env.cli
# edit .env.cli — paste the shpat_ token from Shopify admin
#   Settings → Apps → Develop apps → intl-translator-cli → API credentials

# run
npm run translate -- --target fr      # French
npm run translate -- --target es      # Spanish
npm run translate -- --target hi      # Hindi
```

Per-resource caps are set conservatively in
`app/lib/shopify-translate.server.ts` (PRODUCT:10, METAFIELD:20, …) to keep
the first run fast and safe. Bump these for a real run.

## Architecture

- `cli/translate.ts` — entry point. Parses args, loads `.env.cli`, builds a
  thin `admin.graphql()` client wrapping `fetch` to
  `https://{store}/admin/api/2025-10/graphql.json` with `X-Shopify-Access-Token`.
- `app/lib/shopify-translate.server.ts` — orchestrator. Walks 11 resource
  types via `translatableResources`, filters fields (skips
  handle/url/image/slug keys), batch-translates via the translator service,
  writes via `translationsRegister`. Returns a `TranslationRunResult` with
  per-type counts + samples.
- `app/lib/translator.server.ts` — translation provider. MyMemory primary
  (free, no key, 5K words/day). DeepL fallback if `DEEPL_API_KEY` is set.
  Concurrency=5.
- `app/routes/app._index.tsx` — embedded UI scaffold (NOT currently used by
  the CLI). Kept for Phase 1 of the roadmap.

## Resource types translated (all 11)

PRODUCT, COLLECTION, PAGE, ARTICLE, BLOG, SHOP, SHOP_POLICY, **METAFIELD**,
**METAOBJECT**, ONLINE_STORE_THEME_LOCALE_CONTENT, EMAIL_TEMPLATE.

**Metafield and metaobject coverage is the wedge** over Shopify's free
Translate & Adapt app — that app barely touches them, and themes commonly
stash large amounts of merchant content in metafields (spec tables, FAQs,
hero copy).

## What's left

See `ROADMAP.md` for the full plan. tl;dr:
- **Phase 1 (UI MVP, ~2 weeks):** revive embedded React Router admin UI,
  language picker, progress bar, results table
- **Phase 2 (~3 weeks):** human review queue, glossary, translation memory
- **Phase 3 (~3 weeks):** webhook auto-translate, diff detection, scheduled runs
- **Phase 4 (~1 week):** storefront language switcher snippet, hreflang
- **Phase 5 (~2 weeks):** market/pricelist/currency UI
- **Phase 6 (~2 weeks):** Shopify Billing, GDPR webhooks, App Store submission

## Tested on

`intl-test-lkdfbex8.myshopify.com` — Shopify dev store (Spring '26 admin).
First run: 3 fields EN→FR in 13.5s, 0 errors.

## Secrets / what NOT to commit

- `.env` (Shopify CLI OAuth config — `SHOPIFY_API_SECRET`)
- `.env.cli` (the `shpat_` Admin API access token)

Both are in `.gitignore`. Only `.env.cli.example` ships.

## Don't repeat these mistakes

- Don't try `shopify app dev` with `--use-localhost` for pure embedded
  apps without extensions — Shopify CLI 4.x's localhost proxy returns
  "Invalid path /" for all routes. Use a real tunnel (cloudflared) or
  skip embedded entirely (current CLI approach).
- Don't run `shopify app config link` — it overwrote `access_scopes.scopes`
  to empty string. If you must, back up `shopify.app.toml` first.
- Don't add webhooks to `shopify.app.toml` while developing locally —
  deploy fails on `https://localhost:...` URIs.
- The Polaris web components used in `app/routes/app._index.tsx` reject
  `emphasis="bold"` and `tone="subdued"`. Use `<strong>` and `tone="neutral"`.
