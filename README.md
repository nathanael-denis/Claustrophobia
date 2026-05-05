# Claustrophobia

A survival horror roguelike set in an abandoned mine.
In one sentence, it is dark horror version of an emblematic childhood game: Pokemon Rescue Team.
Instead, in this game, the main character does not have a childhood since he is a child soldier.
He is supposed to go down the mines to monitor the other workers. But something will go terribly wrong...

Developed by Corrofrog Entertainment (a fictionous company, for now).

> You enter an ancient mine. Your lantern flickers, the battery is fading,
> and something is watching you from the dark.

## Overview

Claustrophobia is a turn-based roguelike with a top-down view, inspired
by the movement mechanics of Pokémon Mystery Dungeon, but wrapped in a
survival horror atmosphere. The player explores a procedural dungeon,
manages resources (HP, lantern battery), avoids or fights creatures,
and descends ever deeper.

### Current features

- **Procedural generation**: every floor is a unique dungeon
- **Battery-powered lantern**: tense exploration, the dark is deadly
- **Directional cone of vision**: you only see what you're facing
- **3-state AI**: enemies are idle, chasing, or investigating
- **Sound detection**: moving makes noise, standing still hides you
- **Two enemy types**: goblins (slow, sturdy) and crawlers (fast, fragile)
- **Items**: healing potions, replacement batteries, swords
- **Floor system**: descend deeper, regain 50% HP per floor
- **Central hub (the base)**: a return point between expeditions
- **Dynamic audio**: player footsteps, monster growls and screams based on AI state

## Tech stack

- **TypeScript** + **Vite** for the build
- **Phaser 3** for the 2D engine and scene management
- **rot.js** for procedural generation, FOV, and A* pathfinding

The project follows an architecture where **logic** (World, Action, Actor)
is separated from **rendering** (Phaser scenes), so each layer can be
tested and evolved independently.

## Installation

### Requirements

- **Node.js** v20+ (recommended via [nvm](https://github.com/nvm-sh/nvm))
- **npm** (ships with Node)
- A modern browser (Chrome, Firefox, Edge)

### Run locally

```bash
# Clone the repository
git clone https://github.com/<your-username>/claustrophobia.git
cd claustrophobia

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The game opens at `http://localhost:5173`. Hot reload is active:
any change to a source file automatically reloads the page.

### Build for production

```bash
npm run build
```

The static output goes to `dist/` and can be deployed to any static
hosting service (Vercel, Netlify, GitHub Pages, etc.).

## Controls

| Key | Action |
|---|---|
| Arrows / WASD | Move / turn / attack |
| `.` or Space | Wait one turn |
| `f` | Toggle lantern on/off |
| `g` | Pick up item on the ground |
| `i` | Open / close inventory |
| Letters a-z (in inventory) | Use / equip item |
| Enter | Descend stairs / interact |
| Escape | Back to main menu |

Note: the codebase uses French key bindings (ZQSD as well as Arrow keys).
WASD support and full localization will come later.

## Project structure

```
src/
├── main.ts               # Phaser entry point
├── config.ts             # Global constants (tile size, dimensions)
├── scenes/               # Phaser scenes (rendering and input)
│   ├── SplashScene.ts    # Studio logo
│   ├── MenuScene.ts      # Main menu
│   ├── BaseScene.ts      # Player hub
│   ├── BuildingScene.ts  # North building (placeholder)
│   └── GameScene.ts      # The mine (procedural dungeon)
├── entities/             # Actors and items (pure logic)
│   ├── Actor.ts          # Abstract base class
│   ├── Player.ts         # The player
│   ├── MonsterBase.ts    # Shared AI for monsters
│   ├── Enemy.ts          # The goblin
│   ├── Crawler.ts        # The crawler
│   └── Item.ts           # Items (potions, batteries, equipment)
├── systems/              # Cross-cutting systems (pure logic)
│   ├── World.ts          # Global game state
│   ├── Action.ts         # Polymorphic actions (Move, Attack, etc.)
│   ├── FOV.ts            # Field of view (cone + halo)
│   ├── Lantern.ts        # Lantern with battery and instability
│   ├── Direction.ts      # Direction types and helpers
│   ├── Pathfinding.ts    # rot.js A* wrapper
│   └── AudioManager.ts   # SFX management
├── dungeon/
│   └── Dungeon.ts        # Procedural dungeon generation
└── ui/
    └── Button.ts         # Reusable button helper

public/
└── audio/                # MP3 files (music, SFX)
```

## Git workflow

See [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) for the detailed
versioning workflow used on this project.

## Credits

- Development: Corrofrog Entertainment
- Procedural generation: [rot.js](https://github.com/ondras/rot.js)
- Engine: [Phaser 3](https://phaser.io)

## License

Personal project under development. All rights reserved for now.