# Mosslight

A character action game in a forgotten sanctuary. Choose Fern, Ember, or Aurelia; defeat five encounters, awaken relics, and face the Hollow Guardian.

**[Play the public guest demo](https://timoty-a.github.io/mosslight/)** · Game folder name: **`mosslight`**

## Play

- **WASD / arrows:** move. **Hold J / left click:** sword attack.
- **Space / Shift:** dodge, with brief invulnerability. **P / Escape:** pause.
- On mobile, use the direction, attack, and dodge buttons.
- Defeat the monsters, then walk to the glowing centre to choose a relic blessing. Pink crystals heal you.
- Fern is balanced; Ember is faster; Aurelia has more health. These roles change combat stats. Your appearance comes from start.ng, or the default Guest look.

## Run — no build required

This repository's top-level `index.html` is already playable. Serve the folder with any static server, for example:

```bash
python3 -m http.server 5175 --bind 127.0.0.1
```

Open `http://127.0.0.1:5175`. Alternatively, with Node 22+, run `npm run dev`.

Three.js is pinned to **0.180.0** in an import map on jsDelivr. DM Sans and Manrope load from Google Fonts with system fallbacks. Internet access is needed for Three.js. Game assets use relative paths. No game backend, bundler, secrets, or environment file is required.

## start.ng connection

`src/platform.js` exports `START_NG`, `getCurrentUser()`, `onUserChange(fn)`, and `signIn()`.

- Under `*.start.ng`, it connects to `https://start.ng/connect` in a hidden iframe.
- Under `*.start.localhost`, it connects to `http://start.localhost:5173/connect`.
- Elsewhere, including GitHub Pages, the game is guest-only and explains that sign-in is unavailable.
- `startng:whoami` requests have unique request IDs. Replies must have the exact origin, iframe source, matching ID, and `startng:user` type.
- `null` means signed out; a timeout means **no answer** and never clears an established player. The entire request, including iframe loading, is bounded to 3 seconds.
- Sign-in goes to start.ng with the exact game URL in `return_to`.
- The game rechecks on focus and visible-tab changes. A 15-second visible-tab fallback also catches changes when an embedded browser does not report focus.
- The game receives only the player's ID, name, and style. It never requests passwords, tokens, or emails, and never calls the start.ng API.

Signed-out platform players get **Sign in with start.ng** and **Play as guest**. Signed-in players see their name. Confirmed sign-out restores the Guest appearance; an active run pauses on account changes.

## Central character style

| Field | Game appearance |
| --- | --- |
| `primaryColor` | Tunic, cape, sleeves, hat accents |
| `secondaryColor` | Trousers, hair base, accessory details |
| `skinColor` | Face, neck, hands |
| `hat` | none, cap, beanie, tophat, crown |
| `accessory` | none, glasses, scarf, backpack |

Missing, malformed, or unknown values fall back safely. All required hats/accessories have visible 3D geometry. New platform values such as hair or accessory variants can be added without breaking older games. Keepers remain combat classes; selecting a different keeper does not overwrite your central style.

## Scores

**Scores** shows the five highest local player records. Each start.ng user ID has its own personal best, adventure count, and wins; Guest has a separate record. The board retains up to ten player records in this browser. Records are specific to the game origin and are not a global or server leaderboard.

Score: `100 × foes + 250 × relics + 150 × encounter reached + 1500 for victory`.

A run's score belongs to the player who started it, even if the account changes mid-run. Signed-in names are rendered as text. Blocked or corrupt local storage does not prevent play.

## Upload

Upload these files with their relative paths intact:

```text
index.html
src/main.js
src/rules.js
src/platform.js
src/player.js
src/style.css
public/favicon.svg
```

The game root is ready for the platform's public GitHub repository uploader. `npm run build` is optional: it only copies these seven files into `dist/` for GitHub Pages or packaging. Tests, tooling, `.git`, `.env`, and `node_modules` are not game assets.

For local Worker setup, browser verification, and remaining release steps, see [TESTING.md](TESTING.md).

## Checks

```bash
npm test
npm run build
```

Node 22+ is needed only for these developer helpers. GitHub Actions tests, packages, and deploys the guest demo to GitHub Pages. All 3D assets, animations, and sounds are generated in code.
