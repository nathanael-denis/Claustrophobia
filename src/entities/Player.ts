// src/entities/Player.ts
import { Actor } from "./Actor";
import type { Action } from "../systems/Action";
import type { World } from "../systems/World";
import type { Item, Equipment } from "./Item";
import type { Direction } from "../systems/Direction";
import { Lantern } from "../systems/Lantern";

export class Player extends Actor {
  private nextAction: Action | null;
  public inventory: Item[];
  public equippedWeapon: Equipment | null;
  public direction: Direction;
  public lantern: Lantern;

  constructor(x: number, y: number) {
    super("Toi", x, y, { hp: 20, attack: 5, defense: 1 });
    this.nextAction = null;
    this.inventory = [];
    this.equippedWeapon = null;
    this.direction = "right";
    this.lantern = new Lantern();
  }

  get attack(): number {
    return this.baseAttack + (this.equippedWeapon?.attackBonus ?? 0);
  }

  get defense(): number {
    return this.baseDefense + (this.equippedWeapon?.defenseBonus ?? 0);
  }

  setNextAction(action: Action) {
    this.nextAction = action;
  }

  getAction(_world: World): Action | null {
    const action = this.nextAction;
    this.nextAction = null;
    return action;
  }
}