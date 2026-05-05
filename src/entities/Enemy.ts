// src/entities/Enemy.ts
// Le gobelin : ennemi standard, lent, costaud (relatif).

import { MonsterBase } from "./MonsterBase";
import type { SfxCategory } from "../systems/AudioManager";

export class Enemy extends MonsterBase {
  protected sightLit: number = 6;
  protected sightDark: number = 1;

  public idleSoundCategory: SfxCategory = "growl";
  public hostileSoundCategory: SfxCategory = "scream";

  constructor(name: string, x: number, y: number) {
    super(name, x, y, { hp: 6, attack: 3, defense: 0, speed: 1 });
  }
}