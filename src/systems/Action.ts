// src/systems/Action.ts
import type { World } from "./World";
import type { Actor } from "../entities/Actor";
import type { Item } from "../entities/Item";
import { Player } from "../entities/Player";
import { deltaToDirection, type Direction } from "./Direction";

const HEAL_AMOUNT = 5;
const BATTERY_FULL = 100;

export interface ActionResult {
  success: boolean;
}

export interface Action {
  perform(world: World, actor: Actor): ActionResult;
}

export class WaitAction implements Action {
  perform(): ActionResult {
    return { success: true };
  }
}

export class MoveAction implements Action {
  public dx: number;
  public dy: number;

  constructor(dx: number, dy: number) {
    this.dx = dx;
    this.dy = dy;
  }

  perform(world: World, actor: Actor): ActionResult {
    if (actor instanceof Player) {
      const requested = deltaToDirection(this.dx, this.dy);
      if (requested && requested !== actor.direction) {
        actor.direction = requested;
        return { success: true };
      }
    }

    const newX = actor.x + this.dx;
    const newY = actor.y + this.dy;

    if (!world.dungeon.isWalkable(newX, newY)) {
      return { success: false };
    }

    const target = world.getActorAt(newX, newY);
    if (target && target !== actor) {
      return new AttackAction(target).perform(world, actor);
    }

    actor.x = newX;
    actor.y = newY;
    return { success: true };
  }
}

export class AttackAction implements Action {
  public target: Actor;

  constructor(target: Actor) {
    this.target = target;
  }

  perform(world: World, actor: Actor): ActionResult {
    const damage = Math.max(1, actor.attack - this.target.defense);
    this.target.hp -= damage;
    world.log(`${actor.name} attaque ${this.target.name} (-${damage} PV)`);

    if (this.target.hp <= 0) {
      world.log(`${this.target.name} est vaincu !`);
      world.removeActor(this.target);
    }
    return { success: true };
  }
}

export class PickupAction implements Action {
  perform(world: World, actor: Actor): ActionResult {
    if (!(actor instanceof Player)) return { success: false };

    const ground = world.getItemAt(actor.x, actor.y);
    if (!ground) {
      world.log("Rien à ramasser ici.");
      return { success: false };
    }

    const item = ground.item;
    actor.inventory.push(item);
    world.removeItemFromGround(ground);
    world.log(`Tu ramasses : ${item.name}.`);

    if (item.kind === "equipment" && item.slot === "weapon") {
      if (!actor.equippedWeapon) {
        actor.equippedWeapon = item;
        world.log(`Tu équipes ${item.name}.`);
      }
    }

    return { success: true };
  }
}

export class UseItemAction implements Action {
  public index: number;

  constructor(index: number) {
    this.index = index;
  }

  perform(world: World, actor: Actor): ActionResult {
    if (!(actor instanceof Player)) return { success: false };

    const item: Item | undefined = actor.inventory[this.index];
    if (!item) {
      world.log("Aucun objet à cet emplacement.");
      return { success: false };
    }

    if (item.kind === "consumable") {
      if (item.effect === "heal") {
        const restored = actor.heal(HEAL_AMOUNT);
        if (restored === 0) {
          world.log("Tu es déjà au maximum de PV.");
          return { success: false };
        }
        world.log(`Tu bois ${item.name}. (+${restored} PV)`);
        actor.inventory.splice(this.index, 1);
        return { success: true };
      }

      if (item.effect === "recharge") {
        if (actor.lantern.battery >= BATTERY_FULL) {
          world.log("Ta lampe est déjà à pleine charge.");
          return { success: false };
        }
        const before = actor.lantern.battery;
        actor.lantern.battery = BATTERY_FULL;
        const wasDead = before <= 0;
        if (wasDead) {
          actor.lantern.on = true;
          world.log("Tu insères la pile. La lampe revient à la vie !");
        } else {
          world.log("Tu insères la pile. Batterie : 100%.");
        }
        actor.inventory.splice(this.index, 1);
        return { success: true };
      }
    }

    if (item.kind === "equipment") {
      if (actor.equippedWeapon === item) {
        actor.equippedWeapon = null;
        world.log(`Tu déséquipes ${item.name}.`);
      } else {
        actor.equippedWeapon = item;
        world.log(`Tu équipes ${item.name}.`);
      }
      return { success: true };
    }

    return { success: false };
  }
}

export class ToggleLanternAction implements Action {
  perform(world: World, actor: Actor): ActionResult {
    if (!(actor instanceof Player)) return { success: false };

    if (actor.lantern.battery <= 0) {
      world.log("Ta lampe est morte. Plus de batterie.");
      return { success: false };
    }

    const wasOn = actor.lantern.on;
    actor.lantern.toggle();
    if (wasOn) {
      world.log("Tu éteins ta lampe.");
    } else {
      world.log("Tu allumes ta lampe.");
    }
    return { success: true };
  }
}

export class TurnAction implements Action {
  public direction: Direction;

  constructor(direction: Direction) {
    this.direction = direction;
  }

  perform(_world: World, actor: Actor): ActionResult {
    if (!(actor instanceof Player)) return { success: false };
    actor.direction = this.direction;
    return { success: true };
  }
}

// Descend à l'étage suivant. Ne fonctionne que si le joueur est sur l'escalier.
// La régénération du contenu (ennemis/items/escalier) est faite par GameScene
// après l'action, en réagissant au changement de niveau.
export class DescendAction implements Action {
  perform(world: World, actor: Actor): ActionResult {
    if (!(actor instanceof Player)) return { success: false };
    if (!world.isPlayerOnStairs()) {
      world.log("Il n'y a pas d'escalier ici.");
      return { success: false };
    }
    world.descendToNextLevel();
    return { success: true };
  }
}