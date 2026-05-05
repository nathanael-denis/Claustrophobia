// src/entities/MonsterBase.ts
// Classe de base pour tous les monstres avec IA "détection + poursuite".
// Concentre la logique d'IA pour que Enemy/Crawler/futurs monstres ne fassent
// que définir leurs stats et leurs catégories audio.

import * as ROT from "rot-js";
import { Actor } from "./Actor";
import type { Action } from "../systems/Action";
import type { World } from "../systems/World";
import { MoveAction, WaitAction } from "../systems/Action";
import { findPath } from "../systems/Pathfinding";
import type { SfxCategory } from "../systems/AudioManager";

const ENEMY_HEARING = 2;
const INVESTIGATING_TURNS = 4;

type MonsterState =
  | { kind: "idle" }
  | { kind: "chasing"; lastSeenX: number; lastSeenY: number }
  | { kind: "investigating"; lastSeenX: number; lastSeenY: number; remaining: number };

export abstract class MonsterBase extends Actor {
  protected state: MonsterState;
  protected fovCalculator: InstanceType<typeof ROT.FOV.PreciseShadowcasting> | null;

  // Portée de vision quand la lampe du joueur est allumée
  protected abstract sightLit: number;
  // Portée de vision quand la lampe est éteinte
  protected abstract sightDark: number;

  // Catégories audio à utiliser pour ce monstre. Permet de différencier
  // un gobelin (growl/scream) d'un rampant (crawl_growl/crawl_scream).
  public abstract idleSoundCategory: SfxCategory;
  public abstract hostileSoundCategory: SfxCategory;

  constructor(
    name: string,
    x: number,
    y: number,
    stats: { hp: number; attack: number; defense: number; speed?: number }
  ) {
    super(name, x, y, stats);
    this.state = { kind: "idle" };
    this.fovCalculator = null;
  }

  isHostile(): boolean {
    return this.state.kind === "chasing" || this.state.kind === "investigating";
  }

  protected getFovCalculator(world: World): InstanceType<typeof ROT.FOV.PreciseShadowcasting> {
    if (!this.fovCalculator) {
      this.fovCalculator = new ROT.FOV.PreciseShadowcasting((x, y) =>
        !world.dungeon.blocksSight(x, y)
      );
    }
    return this.fovCalculator;
  }

  protected sightRadius(world: World): number {
    return world.player.lantern.isEmittingLight() ? this.sightLit : this.sightDark;
  }

  protected playerVisibleWithin(world: World, radius: number): boolean {
    const player = world.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > radius) return false;

    let visible = false;
    this.getFovCalculator(world).compute(this.x, this.y, radius, (x, y) => {
      if (x === player.x && y === player.y) visible = true;
    });
    return visible;
  }

  protected canSeePlayer(world: World): boolean {
    return this.playerVisibleWithin(world, this.sightRadius(world));
  }

  protected canHearPlayer(world: World): boolean {
    if (!world.playerMovedThisTurn) return false;
    return this.playerVisibleWithin(world, ENEMY_HEARING);
  }

  protected detectPlayer(world: World): boolean {
    return this.canSeePlayer(world) || this.canHearPlayer(world);
  }

  getAction(world: World): Action {
    const player = world.player;

    const detected = this.detectPlayer(world);
    if (detected) {
      this.state = {
        kind: "chasing",
        lastSeenX: player.x,
        lastSeenY: player.y,
      };
    } else if (this.state.kind === "chasing") {
      if (this.x === this.state.lastSeenX && this.y === this.state.lastSeenY) {
        this.state = {
          kind: "investigating",
          lastSeenX: this.state.lastSeenX,
          lastSeenY: this.state.lastSeenY,
          remaining: INVESTIGATING_TURNS,
        };
      }
    } else if (this.state.kind === "investigating") {
      const newRemaining = this.state.remaining - 1;
      if (newRemaining <= 0) {
        this.state = { kind: "idle" };
      } else {
        this.state = { ...this.state, remaining: newRemaining };
      }
    }

    if (this.state.kind === "chasing") {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) {
        return new MoveAction(Math.sign(dx), Math.sign(dy));
      }
      return this.moveAlongPath(world, this.state.lastSeenX, this.state.lastSeenY);
    }

    if (this.state.kind === "investigating") {
      const dx = this.state.lastSeenX - this.x;
      const dy = this.state.lastSeenY - this.y;
      const distToZone = Math.max(Math.abs(dx), Math.abs(dy));
      if (distToZone > 2) {
        return this.moveAlongPath(world, this.state.lastSeenX, this.state.lastSeenY);
      }
      return this.wander(world);
    }

    return this.wander(world);
  }

  protected moveAlongPath(world: World, targetX: number, targetY: number): Action {
    const path = findPath(this.x, this.y, targetX, targetY, (x, y) => {
      if (x === targetX && y === targetY) return world.dungeon.isWalkable(x, y);
      return world.canMoveTo(x, y, this);
    });

    if (path.length === 0) return new WaitAction();

    const next = path[0];
    return new MoveAction(next.x - this.x, next.y - this.y);
  }

  protected wander(world: World): Action {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const [dx, dy] = directions[Math.floor(Math.random() * directions.length)];
    if (world.canMoveTo(this.x + dx, this.y + dy, this)) {
      return new MoveAction(dx, dy);
    }
    return new WaitAction();
  }
}