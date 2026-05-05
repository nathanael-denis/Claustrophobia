// src/entities/Crawler.ts
// Le rampant : 4 pattes, deux fois plus rapide, mais moitié des PV.
// 1-shot avec une épée équipée. Détecte un peu plus loin (animal nocturne).

import { MonsterBase } from "./MonsterBase";
import type { SfxCategory } from "../systems/AudioManager";

export class Crawler extends MonsterBase {
  protected sightLit: number = 7;
  protected sightDark: number = 2;

  public idleSoundCategory: SfxCategory = "crawl_growl";
  public hostileSoundCategory: SfxCategory = "crawl_scream";

  constructor(x: number, y: number) {
    super("Rampant", x, y, { hp: 3, attack: 3, defense: 0, speed: 2 });
  }
}