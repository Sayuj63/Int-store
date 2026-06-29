# intl-translator-cli — Roadmap

> Status snapshot: 2026-06-30
> Built so far: standalone CLI that bulk-translates a Shopify store using a
> Custom App Admin API token. Translations land in Shopify's native
> Translate & Adapt panel for merchant review.

---

## ✅ Shipped (v0.1 — the engine)

- One-command bulk translate: `npm run translate -- --target fr`
- 11 resource types covered: PRODUCT, COLLECTION, PAGE, ARTICLE, BLOG, SHOP,
  SHOP_POLICY, **METAFIELD**, **METAOBJECT**, ONLINE_STORE_THEME_LOCALE_CONTENT,
  EMAIL_TEMPLATE
- **Metafield + Metaobject bulk translation** — the wedge above Shopify's
  free Translate & Adapt app, which leaves these mostly untouched
- Free translation engine: MyMemory (no key, 5K words/day)
- Optional DeepL fallback (set `DEEPL_API_KEY` in `.env.cli`)
- Unlimited target languages (Shopify's free auto-translate caps at 2)
- Smart skip rules: never translates fields whose key contains `handle`,
  `url`, `image`, `slug`
- HTML-safe — preserves `<b>`, `<i>`, `<a>`, link hrefs
- Per-resource safety caps (PRODUCT:10, METAFIELD:20, …) to prevent
  runaway API spend on first run
- Concurrency=5 to respect rate limits
- Custom App auth — no OAuth, no tunnels, no embedded admin pain
- Terminal output: results table + before/after sample preview
- Output coexists with Translate & Adapt — merchant can review/edit/override

**Tested live:** intl-test-lkdfbex8.myshopify.com — 3 fields EN→FR in 13.5s, 0 errors.

---

## 🚧 Not built yet (the product)

### Phase 1 — Founder UI (turns CLI into an app)
- [ ] Embedded admin dashboard (React Router + Polaris already scaffolded in `app/`)
- [ ] Language picker dropdown in UI (replace `--target` flag)
- [ ] Live progress bar during translation runs
- [ ] Results page with filters (by resource type, by status)
- [ ] Per-resource buttons: retranslate / skip / lock
- [ ] One-click install via Shopify App Store (vs. manually creating Custom App)

### Phase 2 — Quality & review
- [ ] Human review queue — approve/edit before publishing to storefront
- [ ] Side-by-side source↔target diff editor
- [ ] Glossary / brand-term protection (never translate "TCC", "Almost Always", brand names)
- [ ] Confidence score per translation — flag low-confidence for review
- [ ] Translation memory — never re-translate strings we've already done

### Phase 3 — Automation
- [ ] Webhook-driven auto-translate on `PRODUCTS_CREATE` / `PRODUCTS_UPDATE`
- [ ] Diff detection — only translate fields that changed since last run
- [ ] Scheduled re-runs (nightly cron)
- [ ] Bulk CSV import/export for manual overrides

### Phase 4 — Storefront
- [ ] Drop-in language switcher widget for themes
- [ ] Auto hreflang SEO tags
- [ ] Geo-IP suggested language ("Looks like you're in France — switch?")
- [ ] RTL language styling support (Arabic, Hebrew)

### Phase 5 — Markets & pricing (scope expansion from "i18n" → "international")
- [ ] Market creation UI (one click → France market + EUR pricelist)
- [ ] Currency conversion with daily FX rates
- [ ] Country-specific pricing rules
- [ ] Subfolder vs. subdomain routing setup helper

### Phase 6 — App Store readiness
- [ ] Shopify Billing API integration (free + paid tiers)
- [ ] GDPR-mandated webhooks (customer data deletion, shop redact)
- [ ] App listing page + screenshots + demo video
- [ ] Pricing model decision (e.g. free 100 translations/mo, $19 unlimited)
- [ ] Support inbox + docs site

### Phase 7 — Founder analytics
- [ ] "Translations this month" counter
- [ ] Most-viewed languages on storefront
- [ ] Untranslated content alerts
- [ ] Cost / API quota tracker

---

## Timing estimates (rough)

- Phase 1 (UI MVP): ~2 weeks
- Phase 2 + 3 (review + automation): ~3 weeks
- Phase 4 (storefront widget + hreflang): ~1 week
- Phase 5 (markets/pricing): ~2 weeks
- Phase 6 (App Store submission ready): ~2 weeks
- **Total to public App Store listing: ~10 weeks of focused work**

---

## Strategic positioning

**Above Shopify's free Translate & Adapt:**
1. Metafield + metaobject coverage (the only true defensible wedge today)
2. Bulk one-command runs across the entire store
3. Free auto-translate beyond Shopify's 2-language free cap
4. Scriptable / CI-able

**Below paid competitors (Weglot, Langify, Hextom):**
- We're cheaper / free at MVP
- We don't bypass Shopify's native translation system — we feed into it,
  so merchants keep full control via Translate & Adapt
- Metafield/metaobject focus is differentiated even from paid players
