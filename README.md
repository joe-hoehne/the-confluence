# Shards / The Confluence

An immersive, locally playable speculative Realmatic study. Sixteen original Shards, an orbital canvas, luminous procedural SVG crystals with gentle perspective rotation, and a persistent **Arcanum** of discoveries. No backend, accounts, telemetry, AI services, generated media, or external fonts.

## Run

Requires Node.js 24+ and npm.

```powershell
git clone https://github.com/joe-hoehne/the-confluence.git
cd the-confluence
npm install
npm run dev -- --host 127.0.0.1
```

Open the localhost URL printed by Vite. To build and serve the production app:

```powershell
npm run build
npm run preview -- --host 127.0.0.1
```

For the dependency-free production server, use `npm start` after building (default port 8080; override with `PORT`). Vite preview is only for local inspection, not Azure hosting.

The installed project runs without an internet connection. This is not an installable PWA; refreshing still requires the server. Optional lore links open Coppermind externally.

## Azure App Service

The deployed development/testing preview is [The Confluence](https://the-confluence-e8aqcxa0b2a0hmcs.westus3-01.azurewebsites.net). Hosting uses a dedicated App Service plan and app. Deployment is optional; the game runs locally without Azure.

`infra\main.bicep` provisions only a dedicated `rg-the-confluence-westus3`, one Linux **Basic B1** worker in **West US 3**, and the `the-confluence` app. Azure supplies a secure hashed default hostname while preserving that prefix. No database, paid logging service, AI service, registry, custom domain, or additional workers are provisioned. Verified West US 3 Linux B1 USD retail: **$0.017/hour**, approximately **$12.41 at 730 hours/month**, before taxes and any applicable transfer charges; actual billing and subscription-credit eligibility remain governed by Azure.

This deployment is a **development/testing preview**. The deployment command requires the `MSDN_2014-09-01` offer with spending limit **On** and stops if either guard changes; it never converts a subscription or removes the limit. This intentionally narrow deployment helper is not a general production hosting recipe. Check your own benefit eligibility; credit exhaustion can suspend a preview. [Microsoft's Dev/Test terms](https://learn.microsoft.com/azure/devtest/offer/overview-what-is-devtest-offer-visual-studio) and [spending-limit behavior](https://learn.microsoft.com/azure/cost-management-billing/manage/spending-limit).

With PowerShell 7, Azure CLI, Bicep CLI, Node 24 and the existing dependencies available, sign in to the authorized subscription, then:

```powershell
# Copy once and fill in your approved subscription, tenant and exact hostname.
# This local file is ignored by Git; never put credentials in it.
Copy-Item infra\deploy.example.json infra\deploy.local.json
pwsh -NoProfile -File infra\deploy.ps1 -ValidateConfigOnly

# Read-only infrastructure preview; creates no resource group.
npm run deploy:azure

# After review of the infrastructure preview:
npm run deploy:azure -- -Apply

# For an existing-app code update without any infrastructure writes:
npm run deploy:azure -- -Apply -CodeOnly
```

The command pins deployment to the subscription, tenant and exact existing hostname in ignored `infra\deploy.local.json` (or an explicit `-ConfigPath`); zero/invalid identifiers fail before any Azure operation. It does not change the CLI's default subscription. It performs what-if before any writes, validates quota/policy, runs engine/server checks, a reduced-motion production browser check and the production build/lint, then provisions Bicep and publishes a zip through Azure CLI's signed-in Entra authentication. A bounded readiness check reports and retries transient startup 502/503/504 responses; other failures remain explicit. It never requests publishing passwords or enables basic publishing authentication. Repeating it updates the same dedicated resources; review every preview before using `-Apply`.

`-CodeOnly` additionally verifies the existing hostname, region and single-worker Linux B1 plan, and skips all infrastructure create/update calls. Use it for approved application-only redeployments. Public naming attribution and license files are copied into `dist` by Vite and included in the production bundle.

Only `dist`, `server.mjs` and a minimal dependency-free runtime manifest are packaged. Source, tests, naming experiments, review notes and deployment credentials are excluded; temporary packaging is removed afterward. Linux Node 24 LTS runs the production static server with Always On, HTTPS-only, TLS 1.2 minimum, HTTP/2, FTP disabled and SCM/FTP basic publishing disabled. Static responses include CSP, MIME protection, referrer/permissions policies and HTTPS HSTS. Hashed assets use immutable caching, HTML revalidates, and HTML navigation has a shell fallback without turning missing assets into successful HTML responses. `/healthz` is a lightweight readiness check.

The script prints the actual Azure-returned application URL and resource-group portal link after publication. Then verify spoiler consent, source placement, a canonical fusion, Arcanum, and reload persistence in a fresh reduced-motion browser context. Close that validation context afterward; do not resume already-paused local/design previews. Progress is browser-and-origin-local: an Azure visit does not automatically transfer localhost discoveries, and redeploying does not erase existing saves at the same hosted origin.

`npm run test:production` runs a bounded isolated Chromium check against the built production server with reduced motion and GPU acceleration disabled. It closes the browser and temporary server afterward. To check a published deployment instead, set `SHARDS_PRODUCTION_URL` to the actual HTTPS URL first; this uses a fresh browser context, not existing local or hosted saves.

After building, `node --test tests\naming-production.test.mjs` verifies the approved v5 Reconciliation / Innovation / Restraint sequence, canonical Harmony/Retribution, and legacy-save constellation identities and actual edges. It accepts the same hosted-URL environment variable and closes its isolated validation context.

## Play

- Accept the explicit full-canon spoiler warning before entering. Consent is remembered in this browser and can be cleared from the footer.
- Drag a source into the well, or drag any crystal onto another to fuse. Sources are reusable; active operands are consumed.
- Click, tap, or press Enter / Space on a source to place it immediately in the well. Sources never auto-fuse on click, even if a crystal is selected. To fuse without dragging, select two staged crystals in the well by tapping or Enter / Space. Escape cancels selection.
- Compounds can merge with sources or other compounds, repeatedly up to sixteen original Intents. Shared original constituents are explicitly rejected: Harmony cannot merge with Preservation.
- Open **Arcanum** for a stable constellation of recorded powers. Selecting a star illuminates its actual combination history; unrelated stars fade. Only the selected route is connected, avoiding an all-edges tangle. Search names or constituent Shards, or use the compact list with keyboard/touch.
- Inspect a selected crystal for its **Constituent Shards** and **Combination history**. The Arcanum preserves distinct recorded routes, lets you choose among them, and stages a selected power in the well with one **Recall** / **Place** click.
- **Undo action** reverses the last canvas action (up to 30 actions in this session); the Arcanum stays intact. **Clear well** asks for confirmation and preserves the Arcanum.
- Select a staged crystal to reveal its separate **Remove** control, usable by mouse, touch or keyboard. Unselected crystals do not show it. It removes only that crystal from the well, preserves its discoveries and recorded routes, and can be reversed with **Undo action**. The remaining well is saved automatically.
- Progress automatically persists in local storage under `shards-observatory-v1`; consent uses `shards-spoilers-accepted-v1`. An unreadable save is not overwritten. The visible recovery action discards it explicitly. Storage failures show a warning; session play remains available.

## Naming and canon policy

The roster is Ambition, Autonomy, Cultivation, Devotion, Dominion, Endowment, Honor, Invention, Mercy, Odium, Preservation, Reason, Ruin, Valor, Virtuosity, and Whimsy.

Canonical overrides take precedence: **Preservation + Ruin = Harmony**, **Honor + Odium = Retribution**. Only established mergers receive the **Canon merger** badge. Other combinations are our game's interpretations, explained once in About rather than repeatedly labeled. Curated overrides include Constancy, Renewal, Grace, Sovereignty, Symbiosis, Inspiration, Reformation, Revolution, Fervor, Clemency, and Chivalry.

All remaining unordered sets use the user-approved **`relationships-v5`** mapping of **single-word abstract concepts**. A compact, versioned offline lookup reproduces the evaluated v5 resolver exactly; the browser does not import the research tooling or score candidates at runtime. That resolver combines standardized eight-axis meaning (agency, attachment, creation, change, compassion, order, passion, freedom) with direct original-Intent membership and supported relationship anchors. Exact canonical and authored overrides still take precedence. No AI model, random selection, synonym rotation or network service runs during naming.

The approved mapping covers all **65,519 merged sets**, using **145 merged names**. Its six most common names cover **6,781 sets (10.349670%)**; **169,464 of 524,032 single-Intent additions (32.338483%)** retain their name. The reported nested examples now read **Reconciliation** (Honor + Invention + Mercy + Odium), **Innovation** (add Cultivation), and **Restraint** (also add Preservation, Valor and Virtuosity). Reuse is still allowed, and some labels under-explain individual Intents or carry debatable implications. Approval of this mapping is not a claim that every interpretation is literary canon or exhaustive.

`src\naming-v5.generated.ts` records the naming version, original Shard order, approval scope and complete-table SHA-256. Regenerate with `node --experimental-strip-types tools\generate-approved-naming.ts`; use `--check` to verify it without writing. Generation refuses any mapping that differs from the exact approved fingerprint, so changed vocabulary or weights cannot silently become shipped content. The generator and its two required scoring/vocabulary dependencies are retained for reproducibility only; alternate strategies in those dependencies are not active app content. Research reports, downloaded datasets and research-only evaluation tests are excluded. The source words are drawn from existing project concepts and Open English Wordnet 2025; attribution and full license notices ship at `/NAMING-NOTICES.txt` and `/licenses/`.

Names need not be unique: two different sets can share a concept. A sixteen-bit component mask defines study identity; names do not. There are exactly **65,519 merged unordered sets**. Same constituents mean same study identity and name, regardless of merge order. Combination history is a separate immutable binary tree. The Arcanum preserves the first path and any distinct later routes actually recorded; mirrored left/right operands do not fabricate a new route. Saves contain masks and actual paths, not cached display labels. After loading the updated app, existing discoveries, active crystals, search results and histories consistently use the current naming version without deleting or rewriting their identities, routes, timestamps or counts. The storage key and save schema remain version 1. Legacy saves still gain their one recorded path; active crystals retain their actual path.

Crystals symbolize Shardic powers; they are not literal Shards, Shardblades, or gemstones storing a god. Disjoint constituents, reusable sources, order-independent names and Undo are gameplay rules, not established cosmere laws. The Confluence is an invented interface, not a canonical institution. Original Intent glosses are brief interpretations, not exhaustive canonical definitions.

The Dor is intermingled **Splintered Investiture** of Devotion and Dominion in the Cognitive Realm, not an intact single-Vessel merger; this study does not call their intact gameplay combination Dor. Discord is an alternate possible expression of Ruin/Preservation, not an extra original Shard or the default name. The all-sixteen result, **Adonalsium**, is not canon-badged; its result announcement, inspector and About retain the important qualification that reuniting the Shards is not known to restore the original being.

Sources: [Shard](https://coppermind.net/wiki/Shard), [Reason](https://coppermind.net/wiki/Reason), [Harmony](https://coppermind.net/wiki/Harmony), [Retribution](https://coppermind.net/wiki/Retribution), [Dor](https://coppermind.net/wiki/Dor).

## Checks

```powershell
npm test
node --experimental-strip-types tools\generate-approved-naming.ts --check
npm run test:server
npm run build
npm run lint
```

The engine tests exhaust all 65,519 merged sets for complete single-word naming, flattened constituents and order-independent identity/name. They also cover canonical overrides, compound merges, overlap rejection, immutable provenance, distinct recorded routes, graph topology, duplicate-name identities, legacy migration and invalid-save rejection.

Browser checks launch an isolated local Vite server and Chromium with separate storage, without touching a running preview or its saves:

```powershell
npx playwright install chromium --only-shell
npm run test:browser
```

They exercise native mouse dragging, one-click source placement, deliberate staged fusion, keyboard/touch selection, canon-only labels, route selection and topology, search/list alternatives, one-click reuse, reload/migration, responsive widths and reduced motion. Set `SHARDS_SCREENSHOT_DIR` to an existing artifact directory to capture visual evidence.

Responsive layouts, visible keyboard focus, native accessible modal dialogs, live fusion feedback, a touch/keyboard alternative to dragging, reduced-motion support and forced-color styles are included.

## Fan-project notice

Cosmere and its Shards are concepts from Brandon Sanderson's books. This project is currently operated as an unofficial, noncommercial fan experiment and is not affiliated with Brandon Sanderson or Dragonsteel. It contains no book artwork or reproduced prose. Crystal artwork is authored procedural SVG/CSS.

## License

Original project code and authored artwork are licensed under the [MIT License](LICENSE). The description of the current fan project as noncommercial does not restrict the MIT license. Third-party lexical material retains its separate terms in [NAMING-NOTICES.txt](public/NAMING-NOTICES.txt) and [public/licenses](public/licenses/). No license or rights to Brandon Sanderson's or Dragonsteel's intellectual property are granted by this project's license.
