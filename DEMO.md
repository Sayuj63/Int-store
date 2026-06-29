# Translation Autopilot — Demo Run Guide

A Shopify embedded app that translates a store's products, collections, pages, articles, **metafields**, **metaobjects**, shop policies, email templates, and theme strings in one click. Zero-cost stack: MyMemory (free, no API key) + Shopify dev store + local Cloudflare tunnel.

## Prereqs (do once, ~10 min, all free)

1. **Shopify Partners account** — https://partners.shopify.com (free).
2. **Create a dev store** — Partners dashboard → Stores → Add store → *Development store* → "Create a store to test and build" → pick *Start with test data* (gives you ~30 sample products to translate).
3. **Publish a second language** on that dev store — Admin → Settings → Languages → Add language → e.g. Hindi or French → **Publish** (not just add — must be published).

That's it for setup costs. $0.

## Run the app locally

From the project root (`~/Desktop/intl-app`):

```bash
npm run dev
```

The Shopify CLI will:

1. Prompt you to log into your Partners account (browser).
2. Ask whether to create a new app or use an existing one → **Create a new app**, name it e.g. `intl-app`.
3. Ask which dev store to install it on → pick the one from step 2 above.
4. Start a Cloudflare tunnel (free) + dev server.
5. Print an install URL — click it, click **Install** in the Shopify admin.

The app opens embedded inside the Shopify admin.

## Demo flow (~30 seconds end-to-end)

1. The app's home screen loads "Translation autopilot."
2. Top section shows the published source language and a dropdown of target languages (whichever you published in prereqs).
3. Click **Translate everything**.
4. Wait 10–30s (depending on how many resources). MyMemory is rate-limited so it runs 5 requests concurrently.
5. Results table shows per-resource-type counts: PRODUCT, COLLECTION, PAGE, ARTICLE, METAFIELD, METAOBJECT, etc.
6. Sample translations panel shows before/after pairs.
7. **Verify on storefront** — open `https://<your-dev-store>.myshopify.com`, use the header language switcher (Shopify's native one). Product titles, descriptions, pages now appear in the target language.

## What's the wedge to highlight in the demo

When the results table appears, point at the **METAFIELD** and **METAOBJECT** rows. Say:

> "Shopify's own Translate & Adapt skips metaobjects entirely, and existing apps don't reliably cover metafields. We do — that's the wedge."

## Files of interest

```
intl-app/
├── shopify.app.toml              # scopes: read_products, read/write_translations, read_locales, read_content
├── app/
│   ├── routes/app._index.tsx     # the UI
│   └── lib/
│       ├── translator.server.ts  # MyMemory + DeepL adapter
│       └── shopify-translate.server.ts  # GraphQL orchestrator
```

## Cost ceiling

- **MyMemory**: 5,000 words/day anonymous. Set `MYMEMORY_EMAIL=you@example.com` in `.env` to raise to 50,000/day.
- **DeepL Free** (optional upgrade): set `DEEPL_API_KEY=...` in `.env`. 500,000 chars/mo free. Requires CC for signup.
- **Shopify Partners + dev store**: free, unlimited.
- **Cloudflare tunnel** (via `shopify app dev`): free.

## Known demo-day gotchas

- If the target language dropdown is empty: you didn't publish a second language. Go to Admin → Settings → Languages, click **Publish** next to the added language, then reload the app.
- If translations fail intermittently: MyMemory is occasionally slow. Re-run; it picks up where it left off (Shopify will silently ignore re-registers of identical digests).
- If you change scopes (`shopify.app.toml`): the CLI will prompt to re-install the app on the dev store.

## What we cut for tomorrow (build next)

- Per-market price lists (Markets API)
- Custom switcher block (Theme App Embed)
- Glossary for brand terms (don't translate "TCC")
- Webhook re-sync on product update
- Billing (Shopify GraphQL Admin Billing API)
