// src/scenes/BaseScene.ts
// Le "hub" du joueur : zone statique non-procédurale entre les expéditions.
// - Bâtiment Nord avec une porte (mène à BuildingScene)
// - Bâtiment Sud (la maison du joueur, juste décor pour l'instant)
// - Chemin Est vers la mine (déclenche GameScene)
// Pas d'ennemis, pas de batterie. Vision totale, atmosphère apaisante.

import * as Phaser from "phaser";
import { TILE_SIZE } from "../config";
import { DIRECTION_GLYPHS, deltaToDirection, type Direction } from "../systems/Direction";
import { AudioManager } from "../systems/AudioManager";

// Dimensions de la scène base (en cases).
const BASE_WIDTH = 30;
const BASE_HEIGHT = 20;

// Tuiles : 0 = sol traversable, 1 = mur, 2 = porte (interactive), 3 = sortie est
const T_FLOOR = 0;
const T_WALL = 1;
const T_DOOR = 2;
const T_EXIT = 3;

const COLOR_FLOOR = 0x3d3d3d;
const COLOR_WALL = 0x1a1a1a;
const COLOR_DOOR = 0x8d6e63;     // marron porte
const COLOR_PATH = 0x5d4037;     // marron chemin
const COLOR_GRASS = 0x2e3d2e;    // vert sombre extérieur

// Représentation du layout en ASCII pour qu'on le lise facilement.
// '#' = mur, '.' = sol intérieur, ' ' = herbe (extérieur), 'D' = porte, 'P' = chemin, 'E' = sortie est
// 'H' = glyphe central maison (info), 'N' = glyphe central bâtiment Nord
const LAYOUT: string[] = [
  "                              ", // 0
  "        ##########            ", // 1
  "        #........#            ", // 2
  "        #...N....#            ", // 3
  "        #........#            ", // 4
  "        #...DD...#            ", // 5
  "        ####DD####            ", // 6
  "                              ", // 7
  "                              ", // 8
  "                  PPPPPPPPPPPE", // 9
  "                  PPPPPPPPPPPE", // 10
  "                              ", // 11
  "                              ", // 12
  "        ####DD####            ", // 13
  "        #...DD...#            ", // 14
  "        #........#            ", // 15
  "        #...H....#            ", // 16
  "        #........#            ", // 17
  "        ##########            ", // 18
  "                              ", // 19
];

// Position de spawn par défaut (coordonnées en cases)
const SPAWN_X = 13;
const SPAWN_Y = 9;

interface ParsedTile {
  type: number;
  glyph?: string; // pour les tuiles avec un caractère central informatif (H, N)
}

export class BaseScene extends Phaser.Scene {
  private tiles: ParsedTile[][];
  private playerX: number;
  private playerY: number;
  private playerDirection: Direction;
  private playerSprite!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private audio!: AudioManager;
  private isTransitioning: boolean;

  constructor() {
    super("BaseScene");
    this.tiles = [];
    this.playerX = SPAWN_X;
    this.playerY = SPAWN_Y;
    this.playerDirection = "right";
    this.isTransitioning = false;
  }

  preload() {
    this.audio = new AudioManager(this);
    this.audio.preloadAll();
  }

  create() {
    this.isTransitioning = false;
    this.playerX = SPAWN_X;
    this.playerY = SPAWN_Y;
    this.playerDirection = "right";

    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.cameras.main.setBackgroundColor("#0a0a0a");

    this.parseLayout();
    this.drawLayout();
    this.createPlayerSprite();

    this.titleText = this.add
      .text(this.scale.width / 2, 20, "── Le Camp ──", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffeb3b",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.hintText = this.add
      .text(this.scale.width / 2, this.scale.height - 30, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#cccccc",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.refreshHint();

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);

    // Un gong d'ambiance d'arrivée à la base. Si pas de fichier, silence.
    // this.audio.play("gong");
  }

  // Convertit le LAYOUT (strings ASCII) en grille de tuiles.
  private parseLayout() {
    this.tiles = [];
    for (let y = 0; y < BASE_HEIGHT; y++) {
      const row: ParsedTile[] = [];
      const line = LAYOUT[y] ?? "";
      for (let x = 0; x < BASE_WIDTH; x++) {
        const c = line[x] ?? " ";
        switch (c) {
          case "#": row.push({ type: T_WALL }); break;
          case ".": row.push({ type: T_FLOOR }); break;
          case "D": row.push({ type: T_DOOR }); break;
          case "P": row.push({ type: T_FLOOR }); break; // chemin = sol traversable
          case "E": row.push({ type: T_EXIT }); break;
          case "H": row.push({ type: T_FLOOR, glyph: "H" }); break;
          case "N": row.push({ type: T_FLOOR, glyph: "N" }); break;
          default:  row.push({ type: T_FLOOR }); break; // herbe = traversable
        }
      }
      this.tiles.push(row);
    }
  }

  private drawLayout() {
    for (let y = 0; y < BASE_HEIGHT; y++) {
      for (let x = 0; x < BASE_WIDTH; x++) {
        const tile = this.tiles[y][x];
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;

        let color: number;
        const c = LAYOUT[y]?.[x] ?? " ";
        if (tile.type === T_WALL) color = COLOR_WALL;
        else if (tile.type === T_DOOR) color = COLOR_DOOR;
        else if (tile.type === T_EXIT) color = COLOR_PATH;
        else if (c === "P") color = COLOR_PATH;
        else if (c === ".") color = COLOR_FLOOR;
        else color = COLOR_GRASS;

        this.add.rectangle(cx, cy, TILE_SIZE - 1, TILE_SIZE - 1, color).setOrigin(0.5);

        // Glyphe informatif au centre de certains bâtiments
        if (tile.glyph) {
          this.add
            .text(cx, cy, tile.glyph, {
              fontFamily: "monospace",
              fontSize: `${TILE_SIZE - 4}px`,
              color: "#aaaaaa",
            })
            .setOrigin(0.5);
        }
      }
    }
  }

  private createPlayerSprite() {
    this.playerSprite = this.add
      .text(
        this.playerX * TILE_SIZE + TILE_SIZE / 2,
        this.playerY * TILE_SIZE + TILE_SIZE / 2,
        DIRECTION_GLYPHS[this.playerDirection],
        {
          fontFamily: "monospace",
          fontSize: `${TILE_SIZE}px`,
          color: "#ffeb3b",
        }
      )
      .setOrigin(0.5)
      .setDepth(10);
  }

  private isWalkable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= BASE_WIDTH || y >= BASE_HEIGHT) return false;
    const t = this.tiles[y][x].type;
    // Murs bloquent. Tout le reste (sol, porte, sortie) est traversable.
    return t !== T_WALL;
  }

  private currentTileType(): number {
    return this.tiles[this.playerY][this.playerX].type;
  }

  private refreshHint() {
    const t = this.currentTileType();
    if (t === T_DOOR) {
      this.hintText.setText("[Entrée] Entrer dans le bâtiment");
    } else if (t === T_EXIT) {
      this.hintText.setText("[Entrée] Partir vers la mine");
    } else {
      this.hintText.setText("Flèches : se déplacer  ·  [Echap] retour menu");
    }
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (this.isTransitioning) return;

    if (event.key === "Escape") {
      this.transitionToMenu();
      return;
    }

    if (event.key === "Enter") {
      const t = this.currentTileType();
      if (t === T_DOOR) {
        this.transitionToBuilding();
      } else if (t === T_EXIT) {
        this.transitionToMine();
      }
      return;
    }

    let dx = 0;
    let dy = 0;
    switch (event.key) {
      case "ArrowUp": case "z": case "Z": dy = -1; break;
      case "ArrowDown": case "s": case "S": dy = 1; break;
      case "ArrowLeft": case "q": case "Q": dx = -1; break;
      case "ArrowRight": case "d": case "D": dx = 1; break;
      default: return;
    }

    // Mécanique standard : si on regarde dans une autre direction, on se tourne.
    // Sinon on avance si la case devant est traversable.
    const requested = deltaToDirection(dx, dy);
    if (requested && requested !== this.playerDirection) {
      this.playerDirection = requested;
      this.playerSprite.setText(DIRECTION_GLYPHS[this.playerDirection]);
      return;
    }

    const newX = this.playerX + dx;
    const newY = this.playerY + dy;
    if (!this.isWalkable(newX, newY)) {
      return;
    }
    this.playerX = newX;
    this.playerY = newY;
    this.playerSprite.setPosition(
      newX * TILE_SIZE + TILE_SIZE / 2,
      newY * TILE_SIZE + TILE_SIZE / 2
    );
    this.refreshHint();
  }

  private transitionToMenu() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("MenuScene");
    });
  }

  private transitionToBuilding() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("BuildingScene");
    });
  }

  private transitionToMine() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("GameScene");
    });
  }
}