---
description: Resume intl-translator-cli — check status, verify CLI works, pick the next roadmap phase, and start building
---

# /fire — resume the intl-translator-cli project

You are resuming the **intl-translator-cli** Shopify project. This command
re-orients you, verifies the demo still works, and starts the next phase
of roadmap work. **Do not skip steps. Do not assume — verify.**

## Step 1 — Re-orient (read the source of truth)

Read these two files in order:

1. `CLAUDE.md` — project context, architecture, gotchas, why we picked CLI
2. `ROADMAP.md` — 7-phase plan with what's shipped vs. what's left

After reading, in one short paragraph (under 80 words), state to the user:
- What this project is
- The single most important thing currently shipped (the metafield wedge)
- The next unbuilt phase from `ROADMAP.md`

## Step 2 — Verify the demo still works

Run these checks in parallel:

```bash
# Check secrets file exists
test -f .env.cli && echo "OK .env.cli" || echo "MISSING .env.cli"

# Check deps installed
test -d node_modules && echo "OK node_modules" || echo "MISSING node_modules"

# Check git is clean and on main
git status --short && git branch --show-current
```

If `.env.cli` is missing, tell the user to recreate it from
`.env.cli.example` with their `shpat_` token. **Do not proceed without it.**

If `node_modules` is missing, run `npm install` (may take a minute).

## Step 3 — Smoke test the CLI

Run a tiny verification translation to confirm the Shopify token still
works and the engine is healthy:

```bash
npm run translate -- --target fr
```

Expected: results table with non-zero "Translated" count and 0 errors.

If it fails:
- 401 / 403 → token revoked. User needs to reveal a fresh token from
  Shopify admin → Settings → Apps → Develop apps → intl-translator-cli
  → API credentials.
- Rate-limited → wait and retry, or lower per-resource caps in
  `app/lib/shopify-translate.server.ts`.
- Network error → MyMemory might be down. Try DeepL fallback by setting
  `DEEPL_API_KEY` in `.env.cli`.

## Step 4 — Pick the next phase

Look at `ROADMAP.md` "🚧 Not built yet" section. Phases run in order:

1. **Phase 1 — Founder UI** (~2 weeks): embedded admin dashboard, language
   picker, progress bar, results table. The React Router scaffold is
   already in `app/routes/app._index.tsx` — needs reviving with the CLI's
   `runTranslation()` wired into a server action.
2. **Phase 2 — Quality & review** (~3 weeks): review queue, glossary,
   translation memory.
3. **Phase 3 — Automation** (~3 weeks): webhook auto-translate, diff
   detection, scheduled runs.
4. **Phase 4 — Storefront** (~1 week): language switcher snippet, hreflang.
5. **Phase 5 — Markets & pricing** (~2 weeks): market/pricelist/currency UI.
6. **Phase 6 — App Store readiness** (~2 weeks): Billing, GDPR, listing.
7. **Phase 7 — Analytics** (~1 week): dashboard counters, cost tracker.

Tell the user: "Smoke test passed. Roadmap says next phase is **Phase N: <name>** (~<duration>). Want to start that, jump to a different phase, or do something else?"

**Wait for the user's answer before writing any code.**

## Step 5 — Execute the chosen phase

Once user confirms a phase:

1. Use `TaskCreate` to break the phase into 3–8 concrete tasks.
2. Work through them one at a time. Mark `in_progress` when starting,
   `completed` when shipped.
3. Test as you go — for UI work, start the dev server and verify in browser
   before claiming done.
4. Commit in small logical chunks (one commit per task or per cohesive
   change). Use the same commit message style as recent commits in the repo.
5. Push to `origin/main` when the phase milestone is complete.
6. Update `ROADMAP.md` — move completed items from "🚧 Not built yet" to
   "✅ Shipped". Commit that.
7. Update `CLAUDE.md` if architecture or run instructions changed.

## Gotchas — do not repeat past mistakes

- **Do not** run `shopify app config link` — it wiped `access_scopes.scopes`
  to empty string last time. Edit `shopify.app.toml` manually if needed.
- **Do not** try `shopify app dev --use-localhost` for the embedded UI —
  the localhost proxy returns "Invalid path /" for all routes. Use
  cloudflared tunnel (free, `brew install cloudflared`).
- **Do not** add webhooks to `shopify.app.toml` until you have a real
  public URL — deploy fails on `https://localhost:...` URIs.
- **Polaris web components** in `app/routes/app._index.tsx` reject
  `emphasis="bold"` and `tone="subdued"`. Use `<strong>` and `tone="neutral"`.
- **Do not** commit `.env` or `.env.cli` — both are gitignored, keep it that way.

## Tone

User wants to ship a demo, not engineer for hypothetical scale. When in
doubt, pick the simpler path that gets to a working demo today. Frame
trade-offs explicitly so the user can choose.
