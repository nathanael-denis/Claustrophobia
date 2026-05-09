// src/systems/PersistentStore.ts
// Wrapper autour de localStorage pour la progression méta du joueur.

const NAMESPACE = "claustrophobia:";

const KEYS = {
  COBALT: NAMESPACE + "cobalt",
  KILLED: NAMESPACE + "killed",         // bestiaire : monstres tués au moins une fois
  TOTAL_KILLS: NAMESPACE + "total_kills",
  TOTAL_DEATHS: NAMESPACE + "total_deaths",
  UPGRADES: NAMESPACE + "upgrades",     // upgrades achetées (string[])
} as const;

export function hasSave(): boolean {
  try {
    return Object.values(KEYS).some((k) => localStorage.getItem(k) !== null);
  } catch {
    return false;
  }
}

// --- Cobalt ---

export function loadCobalt(): number {
  return loadInt(KEYS.COBALT, 0);
}

export function saveCobalt(value: number): void {
  saveInt(KEYS.COBALT, value);
}

// --- Bestiaire ---

export function loadKilledMonsters(): Set<string> {
  return loadStringSet(KEYS.KILLED);
}

export function markMonsterKilled(kind: string): void {
  const current = loadKilledMonsters();
  if (current.has(kind)) return;
  current.add(kind);
  saveStringSet(KEYS.KILLED, current);
}

// --- Stats globales ---

export function loadTotalKills(): number {
  return loadInt(KEYS.TOTAL_KILLS, 0);
}

export function incrementTotalKills(): void {
  saveInt(KEYS.TOTAL_KILLS, loadTotalKills() + 1);
}

export function loadTotalDeaths(): number {
  return loadInt(KEYS.TOTAL_DEATHS, 0);
}

export function incrementTotalDeaths(): void {
  saveInt(KEYS.TOTAL_DEATHS, loadTotalDeaths() + 1);
}

// --- Upgrades achetées ---

export function loadUnlockedUpgrades(): Set<string> {
  return loadStringSet(KEYS.UPGRADES);
}

export function markUpgradeUnlocked(id: string): void {
  const current = loadUnlockedUpgrades();
  if (current.has(id)) return;
  current.add(id);
  saveStringSet(KEYS.UPGRADES, current);
}

export function isUpgradeUnlocked(id: string): boolean {
  return loadUnlockedUpgrades().has(id);
}

// --- Reset ---

export function reset(): void {
  try {
    for (const key of Object.values(KEYS)) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

// --- Helpers internes ---

function loadInt(key: string, defaultValue: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? defaultValue : Math.max(0, parsed);
  } catch {
    return defaultValue;
  }
}

function saveInt(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(Math.max(0, value)));
  } catch {
    console.warn(`Impossible de sauvegarder ${key} (localStorage indisponible).`);
  }
}

function loadStringSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveStringSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    console.warn(`Impossible de sauvegarder ${key}.`);
  }
}