// src/scenes/GameScene.ts
import * as Phaser from "phaser";
import {
  TILE_SIZE,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_FLOOR,
} from "../config";
import { World, type ActorMovement } from "../systems/World";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { Crawler } from "../entities/Crawler";
import { MonsterBase } from "../entities/MonsterBase";
import {
  MoveAction,
  WaitAction,
  PickupAction,
  UseItemAction,
  ToggleLanternAction,
  DescendAction,
} from "../systems/Action";
import type { Actor } from "../entities/Actor";
import {
  createPotion,
  createSword,
  createBattery,
  type ItemOnGround,
} from "../entities/Item";
import {
  DIRECTION_GLYPHS,
  deltaToDirection,
} from "../systems/Direction";
import { AudioManager } from "../systems/AudioManager";

const COLOR_FLOOR_VISIBLE = 0x4a4a4a;
const COLOR_FLOOR_EXPLORED = 0x1f1f1f;
const COLOR_WALL_VISIBLE = 0x2a2a2a;
const COLOR_WALL_EXPLORED = 0x0c0c0c;
const COLOR_UNSEEN = 0x000000;

const BATTERY_SPAWN_CHANCE = 0.66;
const STAIRS_GLYPH = ">";
const STAIRS_COLOR = "#4caf50";

const MOVE_ANIMATION_MS = 180;
const INTRA_TURN_PAUSE_MS = 0; // pause entre 2 cases pour un acteur rapide
const ENEMY_GROWL_RADIUS = 5;
const ENEMY_GROWL_CHANCE = 0.25;

// Spawn : à chaque tentative, 25% de chance de remplacer un gobelin par
// un rampant. Donc en moyenne ~1 rampant pour 3 gobelins. Conforme à
// "trois fois moins fréquent".
const CRAWLER_SPAWN_CHANCE = 0.25;

export class GameScene extends Phaser.Scene {
  private world!: World;
  private tileRects: Phaser.GameObjects.Rectangle[][];
  private actorSprites: Map<Actor, Phaser.GameObjects.Text>;
  private itemSprites: Map<ItemOnGround, Phaser.GameObjects.Text>;
  private stairsSprite?: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private batteryText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private gameOverText?: Phaser.GameObjects.Text;
  private inventoryOpen: boolean;
  private isProcessingTurn: boolean;
  private audio!: AudioManager;
  private previousEnemyStates: Map<MonsterBase, "idle" | "chasing">;

  constructor() {
    super("GameScene");
    this.tileRects = [];
    this.actorSprites = new Map();
    this.itemSprites = new Map();
    this.inventoryOpen = false;
    this.isProcessingTurn = false;
    this.previousEnemyStates = new Map();
  }

  preload() {
    this.audio = new AudioManager(this);
    this.audio.preloadAll();
  }

  create() {
    this.actorSprites.clear();
    this.itemSprites.clear();
    this.previousEnemyStates.clear();
    this.tileRects = [];
    this.gameOverText = undefined;
    this.stairsSprite = undefined;
    this.inventoryOpen = false;
    this.isProcessingTurn = false;

    this.world = new World();

    const spawn = this.world.dungeon.getSpawnPosition();
    this.world.player = new Player(spawn.x, spawn.y);

    this.populateLevel();
    this.drawDungeon();

    this.createActorSprite(this.world.player, this.playerGlyph(), "#ffeb3b");
    for (const enemy of this.world.enemies) {
      this.createMonsterSprite(enemy);
      this.previousEnemyStates.set(enemy, "idle");
    }
    for (const item of this.world.itemsOnGround) {
      this.createItemSprite(item);
    }
    if (this.world.stairs) {
      this.createStairsSprite();
    }

    this.world.updateFOV();
    this.refreshAll();

    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    this.cameras.main.startFollow(
      this.actorSprites.get(this.world.player)!,
      true,
      0.15,
      0.15
    );

    this.hpText = this.add
      .text(8, 8, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.batteryText = this.add
      .text(8, 30, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffeb3b",
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.levelText = this.add
      .text(this.scale.width - 8, 8, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#bbbbbb",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.inventoryText = this.add
      .text(8, 54, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#cccccc",
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.logText = this.add
      .text(8, this.scale.height - 80, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#bbbbbb",
        wordWrap: { width: this.scale.width - 16 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.refreshUI();

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
  }

  private playerGlyph(): string {
    return DIRECTION_GLYPHS[this.world.player.direction];
  }

  // Crée le sprite d'un monstre selon son type (glyphe + couleur).
  private createMonsterSprite(monster: MonsterBase) {
    if (monster instanceof Crawler) {
      this.createActorSprite(monster, "r", "#ce93d8"); // mauve, pour démarquer du gobelin
    } else {
      this.createActorSprite(monster, "g", "#ef5350");
    }
  }

  private populateLevel() {
    this.spawnEnemies(5);
    this.spawnItems();
    this.placeStairs();
  }

  // Spawn jusqu'à `count` monstres. À chaque slot, tirage pour décider du type :
  // CRAWLER_SPAWN_CHANCE pour un rampant, sinon un gobelin.
  private spawnEnemies(count: number) {
    const rooms = this.world.dungeon.rooms;
    for (let i = 1; i < rooms.length && this.world.enemies.length < count; i++) {
      const room = rooms[i];
      const x = Math.floor((room.getLeft() + room.getRight()) / 2);
      const y = Math.floor((room.getTop() + room.getBottom()) / 2);

      if (Math.random() < CRAWLER_SPAWN_CHANCE) {
        this.world.enemies.push(new Crawler(x, y));
      } else {
        this.world.enemies.push(new Enemy("Gobelin", x, y));
      }
    }
  }

  private findRandomItemSpot(): { x: number; y: number } | null {
    const rooms = this.world.dungeon.rooms;
    if (rooms.length < 2) return null;

    for (let attempt = 0; attempt < 20; attempt++) {
      const room = rooms[1 + Math.floor(Math.random() * (rooms.length - 1))];
      const x = room.getLeft() + Math.floor(Math.random() * (room.getRight() - room.getLeft() + 1));
      const y = room.getTop() + Math.floor(Math.random() * (room.getBottom() - room.getTop() + 1));
      if (
        this.world.dungeon.isWalkable(x, y) &&
        !this.world.getItemAt(x, y) &&
        (!this.world.stairs || this.world.stairs.x !== x || this.world.stairs.y !== y)
      ) {
        return { x, y };
      }
    }
    return null;
  }

  private spawnItems() {
    const rooms = this.world.dungeon.rooms;
    if (rooms.length < 2) return;

    const swordRoom = rooms[1 + Math.floor(Math.random() * (rooms.length - 1))];
    const swordX = Math.floor((swordRoom.getLeft() + swordRoom.getRight()) / 2) + 1;
    const swordY = Math.floor((swordRoom.getTop() + swordRoom.getBottom()) / 2);
    if (this.world.dungeon.isWalkable(swordX, swordY)) {
      this.world.itemsOnGround.push({ item: createSword(), x: swordX, y: swordY });
    }

    const numPotions = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numPotions; i++) {
      const spot = this.findRandomItemSpot();
      if (spot) {
        this.world.itemsOnGround.push({ item: createPotion(), x: spot.x, y: spot.y });
      }
    }

    if (Math.random() < BATTERY_SPAWN_CHANCE) {
      const spot = this.findRandomItemSpot();
      if (spot) {
        this.world.itemsOnGround.push({ item: createBattery(), x: spot.x, y: spot.y });
      }
    }
  }

  private placeStairs() {
    const rooms = this.world.dungeon.rooms;
    if (rooms.length === 0) return;

    const spawnX = this.world.player.x;
    const spawnY = this.world.player.y;

    let bestRoom = rooms[rooms.length - 1];
    let bestDist = -Infinity;

    for (const room of rooms) {
      const cx = (room.getLeft() + room.getRight()) / 2;
      const cy = (room.getTop() + room.getBottom()) / 2;
      const dx = cx - spawnX;
      const dy = cy - spawnY;
      const dist = dx * dx + dy * dy;
      if (dist > bestDist) {
        bestDist = dist;
        bestRoom = room;
      }
    }

    const sx = Math.floor((bestRoom.getLeft() + bestRoom.getRight()) / 2);
    const sy = Math.floor((bestRoom.getTop() + bestRoom.getBottom()) / 2);

    if (this.world.dungeon.isWalkable(sx, sy)) {
      this.world.stairs = { x: sx, y: sy };
    }
  }

  private createStairsSprite() {
    if (!this.world.stairs) return;
    this.stairsSprite = this.add
      .text(
        this.world.stairs.x * TILE_SIZE + TILE_SIZE / 2,
        this.world.stairs.y * TILE_SIZE + TILE_SIZE / 2,
        STAIRS_GLYPH,
        {
          fontFamily: "monospace",
          fontSize: `${TILE_SIZE}px`,
          color: STAIRS_COLOR,
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(5);
  }

  private rebuildSceneAfterDescent() {
    this.audio.stopAllActorSounds();
    this.previousEnemyStates.clear();

    for (const [actor, sprite] of this.actorSprites) {
      if (actor !== this.world.player) {
        sprite.destroy();
        this.actorSprites.delete(actor);
      }
    }
    for (const sprite of this.itemSprites.values()) {
      sprite.destroy();
    }
    this.itemSprites.clear();

    if (this.stairsSprite) {
      this.stairsSprite.destroy();
      this.stairsSprite = undefined;
    }

    for (const row of this.tileRects) {
      for (const rect of row) {
        rect.destroy();
      }
    }
    this.tileRects = [];

    this.populateLevel();
    this.drawDungeon();

    for (const enemy of this.world.enemies) {
      this.createMonsterSprite(enemy);
      this.previousEnemyStates.set(enemy, "idle");
    }
    for (const item of this.world.itemsOnGround) {
      this.createItemSprite(item);
    }
    if (this.world.stairs) {
      this.createStairsSprite();
    }

    const playerSprite = this.actorSprites.get(this.world.player);
    if (playerSprite) {
      playerSprite.setPosition(
        this.world.player.x * TILE_SIZE + TILE_SIZE / 2,
        this.world.player.y * TILE_SIZE + TILE_SIZE / 2
      );
    }
  }

  private drawDungeon() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.tileRects[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const rect = this.add
          .rectangle(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE - 1,
            TILE_SIZE - 1,
            COLOR_UNSEEN
          )
          .setOrigin(0.5, 0.5);
        this.tileRects[y][x] = rect;
      }
    }
  }

  private refreshTiles() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const isFloor = this.world.dungeon.tiles[y][x] === TILE_FLOOR;
        const visible = this.world.fov.isVisible(x, y);
        const explored = this.world.dungeon.explored[y][x];

        let color: number;
        if (visible) {
          color = isFloor ? COLOR_FLOOR_VISIBLE : COLOR_WALL_VISIBLE;
        } else if (explored) {
          color = isFloor ? COLOR_FLOOR_EXPLORED : COLOR_WALL_EXPLORED;
        } else {
          color = COLOR_UNSEEN;
        }
        this.tileRects[y][x].setFillStyle(color);
      }
    }
  }

  private createActorSprite(actor: Actor, glyph: string, color: string) {
    const sprite = this.add
      .text(
        actor.x * TILE_SIZE + TILE_SIZE / 2,
        actor.y * TILE_SIZE + TILE_SIZE / 2,
        glyph,
        {
          fontFamily: "monospace",
          fontSize: `${TILE_SIZE}px`,
          color,
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(10);
    this.actorSprites.set(actor, sprite);
  }

  private createItemSprite(itemOnGround: ItemOnGround) {
    const sprite = this.add
      .text(
        itemOnGround.x * TILE_SIZE + TILE_SIZE / 2,
        itemOnGround.y * TILE_SIZE + TILE_SIZE / 2,
        itemOnGround.item.glyph,
        {
          fontFamily: "monospace",
          fontSize: `${TILE_SIZE}px`,
          color: itemOnGround.item.color,
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(5);
    this.itemSprites.set(itemOnGround, sprite);
  }

  private refreshSpritesVisibility() {
    const playerSprite = this.actorSprites.get(this.world.player);
    if (playerSprite) {
      playerSprite.setText(this.playerGlyph());
    }

    for (const [actor, sprite] of this.actorSprites) {
      if (!actor.isAlive()) {
        this.audio.stopActorSound(actor);
        if (actor instanceof MonsterBase) {
          this.previousEnemyStates.delete(actor);
        }
        sprite.destroy();
        this.actorSprites.delete(actor);
        continue;
      }
      const isPlayer = actor === this.world.player;
      const visible = isPlayer || this.world.fov.isVisible(actor.x, actor.y);
      sprite.setVisible(visible);
    }

    for (const [ground, sprite] of this.itemSprites) {
      if (!this.world.itemsOnGround.includes(ground)) {
        sprite.destroy();
        this.itemSprites.delete(ground);
        continue;
      }
      sprite.setVisible(this.world.fov.isVisible(ground.x, ground.y));
    }

    if (this.stairsSprite && this.world.stairs) {
      const sx = this.world.stairs.x;
      const sy = this.world.stairs.y;
      const visible = this.world.fov.isVisible(sx, sy) || this.world.dungeon.explored[sy][sx];
      this.stairsSprite.setVisible(visible);
    }
  }

  // Anime tous les acteurs vers leur position finale.
  // - Le joueur : une seule transition (départ → arrivée)
  // - Les monstres : selon les `movements` reçus de runTurns(), animations
  //   séquentielles case par case avec pause entre chaque.
// Anime SEULEMENT le joueur. Renvoie quand son tween est fini.
// Utilisé pour gating : on ne débloque les inputs qu'après ça.
private async animatePlayerOnly(playerStartX: number, playerStartY: number): Promise<void> {
    const playerSprite = this.actorSprites.get(this.world.player);
    if (!playerSprite || !playerSprite.active) return;

    const targetX = this.world.player.x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = this.world.player.y * TILE_SIZE + TILE_SIZE / 2;
    const startX = playerStartX * TILE_SIZE + TILE_SIZE / 2;
    const startY = playerStartY * TILE_SIZE + TILE_SIZE / 2;

    playerSprite.setPosition(startX, startY);

    if (startX === targetX && startY === targetY) return;
    await this.tweenTo(playerSprite, targetX, targetY, MOVE_ANIMATION_MS);
  }

  // Lance les animations des ennemis SANS attendre leur fin.
  // Elles se déroulent en parallèle pendant que le joueur peut continuer à jouer.
  private animateEnemiesOnly(movements: ActorMovement[]): void {
    for (const movement of movements) {
      if (!movement.actor.isAlive()) continue;
      const sprite = this.actorSprites.get(movement.actor);
      if (!sprite || !sprite.active) continue;
      // void = on ne fait rien de la Promise, on laisse tourner
      void this.animateActorSequence(sprite, movement.positions);
    }
  }

  // Anime un sprite à travers une séquence de positions, avec une pause entre.
  // positions[0] est la position de départ, positions[N-1] la position d'arrivée.
  private async animateActorSequence(
    sprite: Phaser.GameObjects.Text,
    positions: { x: number; y: number }[]
  ): Promise<void> {
    if (positions.length <= 1) return; // pas bougé

    // S'assurer qu'on démarre au bon endroit
    const startX = positions[0].x * TILE_SIZE + TILE_SIZE / 2;
    const startY = positions[0].y * TILE_SIZE + TILE_SIZE / 2;
    sprite.setPosition(startX, startY);

    // Animer chaque transition successivement
    for (let i = 1; i < positions.length; i++) {
      const targetX = positions[i].x * TILE_SIZE + TILE_SIZE / 2;
      const targetY = positions[i].y * TILE_SIZE + TILE_SIZE / 2;
      await this.tweenTo(sprite, targetX, targetY, MOVE_ANIMATION_MS);
      // Pause entre deux cases (sauf après la dernière)
      if (i < positions.length - 1) {
        await this.delay(INTRA_TURN_PAUSE_MS);
      }
    }
  }

  private tweenTo(sprite: Phaser.GameObjects.Text, x: number, y: number, duration: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: sprite,
        x,
        y,
        duration,
        ease: "Linear",
        onComplete: () => resolve(),
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.time.delayedCall(ms, () => resolve());
    });
  }

  private refreshAll() {
    this.refreshTiles();
    this.refreshSpritesVisibility();
  }

  private batteryColor(battery: number, on: boolean): string {
    if (!on || battery <= 0) return "#666666";
    if (battery <= 20) return "#ff5252";
    if (battery <= 50) return "#ffa726";
    return "#ffeb3b";
  }

  private refreshUI() {
    const p = this.world.player;
    const weapon = p.equippedWeapon ? ` [${p.equippedWeapon.name}]` : "";
    this.hpText.setText(
      `PV : ${p.hp}/${p.maxHp}   ATK : ${p.attack}   DEF : ${p.defense}${weapon}`
    );

    const lanternState = p.lantern.getState();
    const stateLabel: Record<string, string> = {
      stable: "ON",
      unstable: "ON (instable)",
      flickering: "VACILLE",
      off: "OFF",
      dead: "MORTE",
    };
    this.batteryText.setText(
      `Lampe : ${stateLabel[lanternState]}   Batterie : ${p.lantern.battery}%`
    );
    this.batteryText.setColor(this.batteryColor(p.lantern.battery, p.lantern.on));

    this.levelText.setText(`Étage ${this.world.currentLevel}`);

    if (this.inventoryOpen) {
      const lines = ["── Inventaire ──"];
      if (p.inventory.length === 0) {
        lines.push("(vide)");
      } else {
        p.inventory.forEach((item, i) => {
          const equipped = item === p.equippedWeapon ? " (équipé)" : "";
          const key = String.fromCharCode(97 + i);
          lines.push(`${key}) ${item.glyph} ${item.name}${equipped}`);
        });
      }
      lines.push("");
      lines.push("[i] fermer  [a-z] utiliser");
      this.inventoryText.setText(lines.join("\n"));
    } else {
      const itemHere = this.world.getItemAt(p.x, p.y);
      const onStairs = this.world.isPlayerOnStairs();
      let hint: string;
      if (itemHere) {
        hint = `[g] Ramasser : ${itemHere.item.name}`;
      } else if (onStairs) {
        hint = "[Entrée] Descendre dans les profondeurs";
      } else {
        hint = "[i] inv  [.] attendre  [f] lampe  [Echap] menu";
      }
      this.inventoryText.setText(hint);
    }

    const lastMessages = this.world.messages.slice(-4);
    this.logText.setText(lastMessages.join("\n"));
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (this.world.gameOver) {
      this.scene.start("MenuScene");
      return;
    }

    if (this.isProcessingTurn && event.key !== "Escape") {
      return;
    }

    if (event.key === "Escape") {
      if (this.inventoryOpen) {
        this.inventoryOpen = false;
        this.refreshUI();
        return;
      }
      this.audio.stopAllActorSounds();
      this.scene.start("MenuScene");
      return;
    }

    if (this.inventoryOpen) {
      if (event.key === "i") {
        this.inventoryOpen = false;
        this.refreshUI();
        return;
      }
      const code = event.key.charCodeAt(0);
      if (event.key.length === 1 && code >= 97 && code <= 122) {
        const index = code - 97;
        if (index < this.world.player.inventory.length) {
          this.world.player.setNextAction(new UseItemAction(index));
          this.executeTurn(false);
          this.inventoryOpen = false;
        }
        return;
      }
      return;
    }

    let action: ReturnType<Player["getAction"]> = null;
    let isMovementInput = false;

    switch (event.key) {
      case "ArrowUp": case "z": case "Z":
        action = new MoveAction(0, -1); isMovementInput = true; break;
      case "ArrowDown": case "s": case "S":
        action = new MoveAction(0, 1); isMovementInput = true; break;
      case "ArrowLeft": case "q": case "Q":
        action = new MoveAction(-1, 0); isMovementInput = true; break;
      case "ArrowRight": case "d": case "D":
        action = new MoveAction(1, 0); isMovementInput = true; break;
      case ".": case " ":
        action = new WaitAction(); break;
      case "g": case "G":
        action = new PickupAction(); break;
      case "f": case "F":
        action = new ToggleLanternAction(); break;
      case "Enter":
        action = new DescendAction(); break;
      case "i": case "I":
        this.inventoryOpen = true;
        this.refreshUI();
        return;
      default:
        return;
    }

    if (!action) return;

    const player = this.world.player;
    let willActuallyMove = false;
    if (isMovementInput && action instanceof MoveAction) {
      const requested = deltaToDirection(action.dx, action.dy);
      if (requested === player.direction) {
        const tx = player.x + action.dx;
        const ty = player.y + action.dy;
        const target = this.world.getActorAt(tx, ty);
        if (this.world.dungeon.isWalkable(tx, ty) || target) {
          willActuallyMove = true;
        }
      }
    }

    player.setNextAction(action);
    this.executeTurn(willActuallyMove);
  }

  private async executeTurn(playerMoved: boolean) {
    this.isProcessingTurn = true;
    const levelBefore = this.world.currentLevel;

    // Capturer la position de départ du joueur AVANT l'exécution du tour
    const playerStartX = this.world.player.x;
    const playerStartY = this.world.player.y;

    this.world.playerMovedThisTurn = playerMoved;

    const movements = this.world.runTurns();

    this.world.playerMovedThisTurn = false;

    const lantern = this.world.player.lantern;
    const wasUnstable = lantern.battery <= 20 && lantern.battery > 0;
    const result = lantern.tick(playerMoved);
    if (result.wentDark) {
      this.world.log("Ta lampe s'éteint. Plus de batterie.");
    } else if (result.startedFlicker) {
      this.world.log("Ta lampe vacille...");
    } else if (!wasUnstable && lantern.battery <= 20 && lantern.battery > 0) {
      this.world.log("La batterie est faible. La lampe devient instable.");
    }

    if (this.world.currentLevel !== levelBefore) {
      this.rebuildSceneAfterDescent();
      this.world.updateFOV();
      this.refreshAll();
      this.refreshUI();
      this.checkGameOver();
      this.isProcessingTurn = false;
      return;
    }

    if (playerMoved) {
      this.audio.playSelfTerminating("step");
    }

    this.world.updateFOV();
    this.refreshTiles();
    this.refreshSpritesVisibility();

    // On attend SEULEMENT l'animation du joueur (rapide, prévisible).
// Les ennemis animent en parallèle, sans bloquer les inputs suivants.
    await this.animatePlayerOnly(playerStartX, playerStartY);

    // Lance les animations ennemies en arrière-plan (fire-and-forget).
    // Si le joueur joue vite, elles continuent pendant le tour suivant.
    this.animateEnemiesOnly(movements);

    this.updateEnemySounds();
    this.refreshUI();
    this.checkGameOver();

    this.isProcessingTurn = false;
      }

  // Sons d'ennemis : utilise les catégories audio définies par chaque monstre
  // (gobelin → growl/scream, rampant → crawl_growl/crawl_scream).
  private updateEnemySounds() {
    const player = this.world.player;
    for (const enemy of this.previousEnemyStates.keys()) {
      if (!this.world.enemies.includes(enemy)) {
        this.audio.stopActorSound(enemy);
        this.previousEnemyStates.delete(enemy);
      }
    }

    for (const enemy of this.world.enemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const previousState = this.previousEnemyStates.get(enemy) ?? "idle";
      const currentState: "idle" | "chasing" = enemy.isHostile() ? "chasing" : "idle";

      if (previousState === "chasing" && currentState === "idle") {
        this.audio.stopActorSound(enemy);
      }

      if (distance <= ENEMY_GROWL_RADIUS) {
        if (currentState === "chasing") {
          const justBecameHostile = previousState === "idle";
          if (justBecameHostile || Math.random() < ENEMY_GROWL_CHANCE) {
            this.audio.playForActor(enemy, enemy.hostileSoundCategory, {
              distance,
              maxDistance: ENEMY_GROWL_RADIUS + 1,
            });
          }
        } else {
          if (Math.random() < ENEMY_GROWL_CHANCE) {
            this.audio.play(enemy.idleSoundCategory, {
              distance,
              maxDistance: ENEMY_GROWL_RADIUS + 1,
            });
          }
        }
      }

      this.previousEnemyStates.set(enemy, currentState);
    }
  }

  private checkGameOver() {
    if (this.world.gameOver && !this.gameOverText) {
      this.audio.stopAllActorSounds();
      this.gameOverText = this.add
        .text(
          this.scale.width / 2,
          this.scale.height / 2,
          "GAME OVER\n(appuie sur une touche pour revenir au menu)",
          {
            fontFamily: "monospace",
            fontSize: "24px",
            color: "#ff5252",
            align: "center",
          }
        )
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(200);
    }
  }
}