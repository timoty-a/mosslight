# start.ng integration verification

The public GitHub Pages game is a guest demo. The start.ng integration is tested locally; production publication at `relic-keepers.start.ng` is a separate release step and is not claimed here.

## Local environment

Use the team's `startng-fe` **dev** branch and `startng-be` **dev** branch. The actual hosting Worker is on the frontend repository's **worker** branch, in `worker/`.

1. Run PostgreSQL and the backend as described in the team setup. Add `http://start.localhost:5173` to backend `CORS_ORIGINS`, migrate with `alembic upgrade head`, and run the API on port 8000.
2. Run the platform frontend on port 5173. Open **http://start.localhost:5173**, not plain localhost, for this integration.
3. In the Worker directory, create `wrangler.local.toml` with local-only settings. Do not deploy this file:

```toml
name = "startng-games-local"
main = "src/index.js"
compatibility_date = "2026-09-30"
[vars]
BASE_DOMAIN = "start.localhost"
RESERVED_NAMES = "api,auth,login,www,3rdmainland"
CACHE_CONTROL = "no-store"
[[r2_buckets]]
binding = "GAMES_BUCKET"
bucket_name = "startng-games-local"
```

Upload each of the seven game files listed in README with:

```bash
npx -y wrangler@4.145.0 r2 object put \
  "startng-games-local/relic-keepers/<relative-path>" \
  --file "<game-folder>/<relative-path>" --local -c wrangler.local.toml
```

Run the actual Worker:

```bash
npx -y wrangler@4.145.0 dev -c wrangler.local.toml --port 8787 --ip 127.0.0.1
```

Open **http://relic-keepers.start.localhost:8787/**. Do not open the bare Worker address. Local R2 and the local database do not publish anything to production.

## Browser checklist

- Start signed out: confirm the sign-in and Guest buttons.
- Play as Guest: confirm Guest name and default appearance.
- Choose Sign in with start.ng: verify the platform return URL, sign in on the platform, and return to the game.
- Verify the player's name and primary/secondary/skin colours and accessories.
- Change the character on the platform while the game stays open. Returning to the visible game, or its visible-tab fallback, should update the look without reloading.
- Sign out on the platform while the game stays open: it should return to Guest, show sign-in choices, and reset the look. A failed/unanswered check must not impersonate a confirmed sign-out.
- Finish a run and inspect Scores. Reload and verify persistence. Another user and Guest must have separate bests.

## Automated checks

`npm test` covers the three origin/source/request-ID checks; platform hostname detection; signed-out versus unanswered requests; iframe load timeout; stale replies; sign-in return URLs; account-change callbacks; all required style options and fallbacks; per-player score separation; best-score preservation; unavailable storage; and the combat rules.

## Production release still required

- Publish the updated repository through your real start.ng account/team workflow.
- Verify the live `*.start.ng` sign-in/return/style flow.
- Record the required testing video with the team repository URL visible and follow the team PR/staging process.

Google OAuth and real production hosting credentials are not needed for the disposable local email-account test, and are not included in this repository.

## Verified in this workspace

- Real frontend dev `e2f5ff1`, backend dev `1d87f92`, and Worker `86898fe`, running locally against PostgreSQL and Wrangler **4.145.0** local R2.
- Signed-out choices → Guest gameplay → platform email sign-in → automatic return to the game with the disposable test player's name and look.
- Primary/secondary/skin colour changes, a crown/backpack, cap/glasses, and beanie/scarf checked against the real saved character.
- Central changes reached the already-open game without reloading. Sign-out restored Guest and removed the hat/accessory through the visible-tab fallback check. Focus/visibility event handling and no-answer preservation are also covered by automated tests.
- Guest-only behaviour on an ordinary localhost origin; local scores and storage isolation covered by automated checks.
- 18 automated checks passed; the seven-file static package and relative paths checked.

Not tested here: real Google OAuth, a real production start.ng publication, or the live production cross-subdomain session. The local test uses a disposable email account and does not alter your real start.ng account.
