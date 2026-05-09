// src/data/Catalog.ts
// Données statiques utilisées par les UI (bestiaire, inventaire détaillé).
// Centraliser ici évite la duplication entre code de gameplay et code d'affichage,
// et te permet de remplir les descriptions placeholder à ton rythme.

export interface MonsterEntry {
  kind: string;        // identifiant stable (matche MonsterBase.monsterKind)
  name: string;        // nom affiché
  glyph: string;       // glyphe utilisé en jeu
  glyphColor: string;  // couleur du glyphe en jeu
  icon: string;        // icône Unicode pour les UI menus
  stats: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  };
  description: string; // texte du bestiaire (à remplir plus tard)
}

export const MONSTER_CATALOG: MonsterEntry[] = [
  {
    kind: "goblin",
    name: "Gobelin",
    glyph: "g",
    glyphColor: "#ef5350",
    icon: "👹",
    stats: { hp: 6, attack: 3, defense: 0, speed: 1 },
    description:
      "[Description à compléter]\n\n" +
      "Créature humanoïde de petite taille rencontrée dans les profondeurs " +
      "de la mine. Lente mais robuste.",
  },
  {
    kind: "crawler",
    name: "Rampant",
    glyph: "r",
    glyphColor: "#ce93d8",
    icon: "🕷",
    stats: { hp: 3, attack: 3, defense: 0, speed: 2 },
    description:
      "[Description à compléter]\n\n" +
      "Créature à quatre pattes, rapide et nerveuse. " +
      "Fragile mais dangereuse en raison de sa vitesse de déplacement.",
  },
];

export function getMonsterEntry(kind: string): MonsterEntry | undefined {
  return MONSTER_CATALOG.find((m) => m.kind === kind);
}

// --- Items ---

export interface ItemDisplayInfo {
  // Mappe un nom d'item → icône Unicode + description
  icon: string;
  description: string;
}

// Les noms ici doivent matcher exactement ceux retournés par les factory
// d'Item.ts (createPotion, createBattery, etc.)
export const ITEM_DISPLAY: Record<string, ItemDisplayInfo> = {
  "Potion de soin": {
    icon: "🧪",
    description: "Restaure 5 PV à l'utilisation. Indispensable en exploration profonde.",
  },
  "Pile": {
    icon: "🔋",
    description: "Recharge complètement la batterie de la lampe. Si la lampe était morte, la rallume.",
  },
  "Épée": {
    icon: "⚔",
    description: "Arme de mêlée. +3 ATK lorsque équipée. S'équipe automatiquement au ramassage si aucune arme n'est portée.",
  },
  "Cobalt magique": {
    icon: "💎",
    description: "Ressource précieuse utilisée pour la progression méta. Conservée entre les expéditions à condition de descendre l'escalier après le ramassage.",
  },
};

// Récupère l'icône d'un item par son nom, avec fallback sur le glyphe ASCII
// si on n'a pas d'entrée Unicode pour cet item.
export function getItemIcon(itemName: string, fallbackGlyph: string): string {
  return ITEM_DISPLAY[itemName]?.icon ?? fallbackGlyph;
}

export function getItemDescription(itemName: string): string {
  return ITEM_DISPLAY[itemName]?.description ?? "Aucune description disponible.";
}