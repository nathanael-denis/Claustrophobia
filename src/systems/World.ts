// src/systems/World.ts
import { Dungeon } from "../dungeon/Dungeon";
import { FOV } from "./FOV";
import type { Actor } from "../entities/Actor";
import type { Player } from "../entities/Player";
import type { MonsterBase } from "../entities/MonsterBase";
import type { ItemOnGround } from "../entities/Item";

const DESCENT_HEAL_FLOOR_PERCENT = 0.5;

export interface Stairs {
  x: number;
  y: number;
}

// Type renvoyé par runTurns : on indique pour chaque acteur ennemi
// la séquence des positions intermédiaires qu'il a occupées pendant ce tour.
// Permet à GameScene de faire des animations séquentielles pour les ennemis
// rapides (case par case avec pause).
export interface ActorMovement {
  actor: Actor;
  // Positions successives (case par case). Le premier élément est la position
  // de DÉPART, et chaque suivant est une nouvelle case occupée.
  // Pour speed=1 : 2 entrées max (départ + arrivée).
  // Pour speed=2 : 3 entrées max (départ + intermédiaire + arrivée).
  positions: { x: number; y: number }[];
}

export class World {
  public dungeon: Dungeon;
  public fov: FOV;
  public player!: Player;
  // On utilise MonsterBase pour le typage : Enemy et Crawler en héritent.
  public enemies: MonsterBase[];
  public itemsOnGround: ItemOnGround[];
  public stairs: Stairs | null;
  public messages: string[];
  public gameOver: boolean;
  public currentLevel: number;
  public playerMovedThisTurn: boolean;

  constructor() {
    this.dungeon = new Dungeon();
    this.fov = new FOV(this.dungeon);
    this.enemies = [];
    this.itemsOnGround = [];
    this.stairs = null;
    this.messages = [];
    this.gameOver = false;
    this.currentLevel = 1;
    this.playerMovedThisTurn = false;
  }

  get actors(): Actor[] {
    return [this.player, ...this.enemies].filter((a) => a.isAlive());
  }

  getActorAt(x: number, y: number): Actor | undefined {
    return this.actors.find((a) => a.x === x && a.y === y);
  }

  getItemAt(x: number, y: number): ItemOnGround | undefined {
    return this.itemsOnGround.find((i) => i.x === x && i.y === y);
  }

  removeItemFromGround(item: ItemOnGround) {
    this.itemsOnGround = this.itemsOnGround.filter((i) => i !== item);
  }

  canMoveTo(x: number, y: number, mover: Actor): boolean {
    if (!this.dungeon.isWalkable(x, y)) return false;
    const blocker = this.getActorAt(x, y);
    return !blocker || blocker === mover;
  }

  removeActor(actor: Actor) {
    if (actor === this.player) {
      this.gameOver = true;
      this.log("Tu es mort. Game Over.");
      return;
    }
    this.enemies = this.enemies.filter((e) => e !== actor);
  }

  log(message: string) {
    this.messages.push(message);
    if (this.messages.length > 50) this.messages.shift();
  }

  isPlayerOnStairs(): boolean {
    if (!this.stairs) return false;
    return this.player.x === this.stairs.x && this.player.y === this.stairs.y;
  }

  descendToNextLevel(): { spawnX: number; spawnY: number } {
    this.currentLevel += 1;

    const healFloor = Math.ceil(this.player.maxHp * DESCENT_HEAL_FLOOR_PERCENT);
    if (this.player.hp < healFloor) {
      const healed = healFloor - this.player.hp;
      this.player.hp = healFloor;
      this.log(`Tu descends. Tu reprends des forces. (+${healed} PV)`);
    } else {
      this.log("Tu descends dans les profondeurs.");
    }

    this.dungeon = new Dungeon();
    this.fov = new FOV(this.dungeon);

    this.enemies = [];
    this.itemsOnGround = [];
    this.stairs = null;

    const spawn = this.dungeon.getSpawnPosition();
    this.player.x = spawn.x;
    this.player.y = spawn.y;

    return { spawnX: spawn.x, spawnY: spawn.y };
  }

  updateFOV() {
    if (this.player.lantern.isEmittingLight()) {
      this.fov.computeWithLantern(
        this.player.x,
        this.player.y,
        this.player.direction
      );
    } else {
      this.fov.computeHaloOnly(this.player.x, this.player.y);
    }
  }

  // Exécute un tour complet. Renvoie la liste des mouvements observés pour
  // chaque acteur ennemi (utile pour les animations séquentielles côté scène).
  // Le joueur agit une fois (sa speed est ignorée ici, c'est lui qui rythme).
  // Les ennemis agissent jusqu'à `speed` fois, dans l'ordre.
  runTurns(): ActorMovement[] {
    if (this.gameOver) return [];

    // Initialiser le tracking des positions pour les ennemis vivants.
    // On capture la position de départ pour chacun.
    const movements = new Map<Actor, ActorMovement>();
    for (const enemy of this.enemies) {
      if (enemy.isAlive()) {
        movements.set(enemy, {
          actor: enemy,
          positions: [{ x: enemy.x, y: enemy.y }],
        });
      }
    }

    // 1. Tour du joueur
    const playerAction = this.player.getAction(this);
    if (playerAction) {
      playerAction.perform(this, this.player);
    } else {
      // Pas d'action du joueur : on n'avance pas. On retourne vide.
      return [];
    }

    if (this.gameOver) return Array.from(movements.values());

    // 2. Tour des ennemis : on fait jusqu'à maxSpeed passes.
    // À chaque passe, seuls les ennemis dont speed >= passe agissent.
    const maxSpeed = this.enemies.reduce(
      (max, e) => Math.max(max, e.speed),
      1
    );

    for (let pass = 1; pass <= maxSpeed; pass++) {
      // Snapshot des ennemis vivants pour cette passe (peut changer pendant)
      const enemiesThisPass = this.enemies.filter(
        (e) => e.isAlive() && e.speed >= pass
      );
      for (const enemy of enemiesThisPass) {
        if (this.gameOver) return Array.from(movements.values());
        if (!enemy.isAlive()) continue; // peut avoir été tué pendant la passe

        const action = enemy.getAction(this);
        if (action) {
          action.perform(this, enemy);
          // Tracker la nouvelle position si elle a changé
          const tracking = movements.get(enemy);
          if (tracking) {
            const last = tracking.positions[tracking.positions.length - 1];
            if (last.x !== enemy.x || last.y !== enemy.y) {
              tracking.positions.push({ x: enemy.x, y: enemy.y });
            }
          }
        }
      }
    }

    return Array.from(movements.values());
  }
}