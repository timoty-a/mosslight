# Relic Keepers

**A little hero. A great adventure.** An original Three.js action game set in a forgotten, moss-covered sanctuary. Choose a keeper, fight monsters with a sword, dodge their attacks, awaken relics, and face the Hollow Guardian.

**[Play Relic Keepers](https://timoty-a.github.io/relic-keepers/)**

## Meet the keepers

| Keeper | Role | Health | Strength |
| --- | --- | --- | --- |
| Fern | Wayfarer | 110 | Balanced movement and sword damage |
| Ember | Swiftblade | 85 | Faster movement and stronger strikes |
| Aurelia | Guardian | 145 | More health for a forgiving adventure |

## The adventure

Five encounters introduce mosslings, ranged wraiths, stone brutes, and an ancient boss. Enemy warning circles telegraph attacks. Defeat each encounter, then walk to the centre to awaken a relic and choose a blessing:

- **Sunforged blade:** 30% more sword damage.
- **Heart of the grove:** +30 maximum health and a full heal.
- **Windwalker's gift:** faster attacks and quicker dodge recovery.

Defeated enemies can drop pink healing crystals. Each awakened relic also restores 22 health. Defeat all enemies in the final encounter to win.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | WASD or arrow keys | Direction buttons |
| Attack | Hold J or hold the left mouse button over the arena | Hold ATTACK |
| Dodge | Space or Shift | DODGE button |
| Aim | Automatically faces nearby enemies; move mouse to aim manually | Automatic |
| Pause / resume | P or Escape | Pause button |

Movement follows the screen's directions. Dodge grants brief invulnerability and recharges between uses. The game pauses when its tab loses focus.

## Local development

Node.js **20.19+ or 22.12+** required.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:5175`.

```bash
npm test
npm run build
npm run preview
```

## Technical notes

- Three.js + Vite + plain JavaScript, HTML, and CSS.
- Fixed-step combat simulation, sword hit cones, enemy separation, knockback, wind-up attacks, ranged projectiles, and a two-pattern boss.
- Original code-generated characters, sword animations, dodge rolls, ruins, trees, particles, icons, and synthesized sound. No downloaded 3D models or texture packs.
- Instanced floor tiles and vegetation. Shared geometry and materials for reusable assets.
- DM Sans and Manrope from Google Fonts, with system font fallbacks.
- Character choice and victory count persist locally when browser storage is available. No accounts or global leaderboard in this demo.
- GitHub Actions tests and builds the game, then deploys `dist/` to GitHub Pages. Pages must use GitHub Actions as its source.

## start.ng

This public version runs as a **guest demo**. It is not deployed on start.ng and does not claim to fulfil the assignment's authenticated-player or central-styling requirements yet.

An optional proposed adapter accepts presentation data from the real authenticated platform host:

```js
window.RelicKeepers.setSession({
  user: { id: 'actual-platform-user-id', name: 'Player name' },
  appearance: { primaryColor: '#397f70' }
});
```

For an iframe, the game emits `{ type: 'relic-keepers:ready', version: 1 }`. A trusted parent can send `{ type: 'startng:session', session: { user, appearance } }` to the game's exact origin. Accepted parent origins are `https://start.ng`, `https://www.start.ng`, and `http://localhost:5173`. Both the message origin and actual parent window are checked. Never send JWTs or other credentials to the game.

`primaryColor` must be a six-digit hex colour and changes the keeper's clothing. This contract is a proposed integration point, not an official start.ng SDK. The team must connect the real authenticated player and appearance source, confirm publishing requirements, and test the deployed game on start.ng.
