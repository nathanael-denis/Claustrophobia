// src/entities/Actor.ts
import type { World } from "../systems/World";
import type { Action } from "../systems/Action";

export abstract class Actor {
  public name: string;
  public x: number;
  public y: number;
  public hp: number;
  public maxHp: number;
  public baseAttack: number;
  public baseDefense: number;
  // Nombre d'actions que cet acteur joue par "tour de joueur".
  // 1 = vitesse normale (défaut), 2 = deux fois plus rapide, etc.
  public speed: number;

  constructor(
    name: string,
    x: number,
    y: number,
    stats: { hp: number; attack: number; defense: number; speed?: number }
  ) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.baseAttack = stats.attack;
    this.baseDefense = stats.defense;
    this.speed = stats.speed ?? 1;
  }

  get attack(): number {
    return this.baseAttack;
  }

  get defense(): number {
    return this.baseDefense;
  }

  abstract getAction(world: World): Action | null;

  isAlive(): boolean {
    return this.hp > 0;
  }

  heal(amount: number): number {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }
}