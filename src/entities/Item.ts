// src/entities/Item.ts
// Items du jeu. Union discriminée pour différencier consommables et équipements.

export interface ItemBase {
  name: string;
  glyph: string;
  color: string;
}

export interface Consumable extends ItemBase {
  kind: "consumable";
  // Discriminant interne aux consommables : type d'effet
  effect: "heal" | "recharge";
}

export interface Equipment extends ItemBase {
  kind: "equipment";
  slot: "weapon";
  attackBonus: number;
  defenseBonus: number;
}

export type Item = Consumable | Equipment;

// --- Factory functions ---

export function createPotion(): Consumable {
  return {
    kind: "consumable",
    name: "Potion de soin",
    glyph: "!",
    color: "#e91e63",
    effect: "heal",
  };
}

export function createBattery(): Consumable {
  return {
    kind: "consumable",
    name: "Pile",
    glyph: "=",
    color: "#4dd0e1", // cyan vif, très distinct des potions et de l'épée
    effect: "recharge",
  };
}

export function createSword(): Equipment {
  return {
    kind: "equipment",
    name: "Épée",
    glyph: "/",
    color: "#90caf9",
    slot: "weapon",
    attackBonus: 3,
    defenseBonus: 0,
  };
}

// --- Item posé au sol ---

export interface ItemOnGround {
  item: Item;
  x: number;
  y: number;
}