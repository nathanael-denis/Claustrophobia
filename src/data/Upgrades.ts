// src/data/Upgrades.ts
// Catalogue des améliorations méta-progression.
//
// Pour ajouter une nouvelle upgrade :
// 1. Ajouter une entrée dans UPGRADES_CATALOG
// 2. Si elle a un effet sur les stats du joueur, le gérer dans Player.applyUpgrades()
// 3. Si elle a un effet sur la vision/lampe, le gérer là où c'est pertinent
//
// Les préconditions sont évaluées via canAfford() qui lit le PersistentStore.
// L'achat est effectué via purchase() qui consomme le cobalt et marque l'upgrade.

import {
  loadCobalt,
  saveCobalt,
  loadTotalKills,
  loadTotalDeaths,
  isUpgradeUnlocked,
  markUpgradeUnlocked,
} from "../systems/PersistentStore";

export type UpgradeCategory = "combat" | "exploration";

// Préconditions à remplir pour pouvoir acheter une upgrade.
// Toutes les conditions doivent être vraies simultanément.
export interface UpgradeRequirements {
  cobalt: number;          // cobalt à dépenser (consommé à l'achat)
  totalKills?: number;     // kills minimum dans toutes les runs
  totalDeaths?: number;    // morts minimum dans toutes les runs
  requires?: string[];     // IDs d'upgrades pré-requises (chaîne d'arbre futur)
}

export interface Upgrade {
  id: string;              // identifiant unique stable (utilisé en localStorage)
  name: string;
  category: UpgradeCategory;
  icon: string;            // emoji unicode pour l'UI
  description: string;     // ce que ça fait, en clair
  requirements: UpgradeRequirements;
}

export const UPGRADES_CATALOG: Upgrade[] = [
  {
    id: "ruthless",
    name: "Impitoyable",
    category: "combat",
    icon: "⚔",
    description:
      "Augmente les Points de Vie maximums de 10. " +
      "Pour les guerriers endurcis qui ont fait couler beaucoup de sang.",
    requirements: {
      cobalt: 2,
      totalKills: 50,
    },
  },
  {
    id: "nyctalope",
    name: "Nyctalope",
    category: "exploration",
    icon: "👁",
    description:
      "Tes yeux se sont habitués à l'obscurité. Vois une case plus loin lampe éteinte. " +
      "Le prix de chaque mort fut un apprentissage.",
    requirements: {
      cobalt: 5,
      totalDeaths: 15,
    },
  },
];

export function getUpgrade(id: string): Upgrade | undefined {
  return UPGRADES_CATALOG.find((u) => u.id === id);
}

export function getUpgradesByCategory(category: UpgradeCategory): Upgrade[] {
  return UPGRADES_CATALOG.filter((u) => u.category === category);
}

// Évalue chaque précondition individuellement et renvoie un objet détaillé
// pour que l'UI puisse afficher quelle condition manque.
export interface RequirementsCheck {
  cobaltOk: boolean;
  killsOk: boolean;
  deathsOk: boolean;
  requiresOk: boolean;
  allOk: boolean;
}

export function checkRequirements(upgrade: Upgrade): RequirementsCheck {
  const cobalt = loadCobalt();
  const kills = loadTotalKills();
  const deaths = loadTotalDeaths();

  const cobaltOk = cobalt >= upgrade.requirements.cobalt;
  const killsOk =
    upgrade.requirements.totalKills === undefined ||
    kills >= upgrade.requirements.totalKills;
  const deathsOk =
    upgrade.requirements.totalDeaths === undefined ||
    deaths >= upgrade.requirements.totalDeaths;
  const requiresOk =
    !upgrade.requirements.requires ||
    upgrade.requirements.requires.every((id) => isUpgradeUnlocked(id));

  return {
    cobaltOk,
    killsOk,
    deathsOk,
    requiresOk,
    allOk: cobaltOk && killsOk && deathsOk && requiresOk,
  };
}

// Effectue l'achat. Renvoie true si succès, false sinon.
// L'appelant doit gérer l'UI (rafraîchir affichage, message d'erreur).
export function purchase(upgrade: Upgrade): boolean {
  if (isUpgradeUnlocked(upgrade.id)) return false;

  const check = checkRequirements(upgrade);
  if (!check.allOk) return false;

  // Consommer le cobalt
  const currentCobalt = loadCobalt();
  saveCobalt(currentCobalt - upgrade.requirements.cobalt);

  // Marquer comme acheté
  markUpgradeUnlocked(upgrade.id);

  return true;
}