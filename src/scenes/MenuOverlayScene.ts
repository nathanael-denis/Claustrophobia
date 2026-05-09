// src/scenes/MenuOverlayScene.ts
// Scène en surimpression. Cinq onglets :
// - Carte : visualisation du donjon (GameScene uniquement)
// - Inventaire : items détaillés
// - Bestiaire : monstres rencontrés
// - Progression : achat d'upgrades méta (BaseScene uniquement)
// - Stats : compteurs globaux (kills, morts, etc.)
//
// Activation : touche 'p' depuis GameScene/BaseScene.
// Lancée via : scene.launch("MenuOverlayScene", { parentSceneKey, world? })

import * as Phaser from "phaser";
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, TILE_FLOOR } from "../config";
import type { World } from "../systems/World";
import type { Item } from "../entities/Item";
import {
  loadCobalt,
  loadKilledMonsters,
  loadTotalKills,
  loadTotalDeaths,
  loadUnlockedUpgrades,
} from "../systems/PersistentStore";
import {
  MONSTER_CATALOG,
  getItemIcon,
  getItemDescription,
} from "../data/Catalog";
import {
  UPGRADES_CATALOG,
  checkRequirements,
  purchase, 
  type Upgrade,
  type UpgradeCategory,
} from "../data/Upgrades";

export interface MenuOverlayData {
  parentSceneKey: string;
  world?: World;
}

type Tab = "map" | "inventory" | "bestiary" | "progression" | "stats";
const TAB_ORDER: Tab[] = ["map", "inventory", "bestiary", "progression", "stats"];
const TAB_LABELS: Record<Tab, string> = {
  map: "Carte",
  inventory: "Inventaire",
  bestiary: "Bestiaire",
  progression: "Progression",
  stats: "Stats",
};

const COLOR_BG = 0x000000;
const COLOR_BG_ALPHA = 0.85;
const COLOR_PANEL = 0x1a1a1a;
const COLOR_PANEL_BORDER = 0x666666;
const COLOR_TAB_ACTIVE = 0x4a4a4a;
const COLOR_TAB_INACTIVE = 0x252525;
const COLOR_TEXT = "#cccccc";
const COLOR_TEXT_DIM = "#888888";
const COLOR_TITLE = "#ffeb3b";
const COLOR_LOCKED = "#444444";
const COLOR_OK = "#81c784";
const COLOR_NOT_OK = "#e57373";
const COLOR_COBALT = "#9575cd";

const MAP_TILE_SIZE = 12;
const MAP_SCROLL_STEP = 3;

export class MenuOverlayScene extends Phaser.Scene {
  private parentSceneKey!: string;
  private world?: World;
  private currentTab: Tab;

  private rootContainer!: Phaser.GameObjects.Container;
  private tabContainers!: Record<Tab, Phaser.GameObjects.Container>;
  private tabLabels!: Record<Tab, Phaser.GameObjects.Text>;

  private mapOffsetX: number;
  private mapOffsetY: number;

  private bestiaryIndex: number;
  private upgradeIndex: number;

  // Pour pouvoir reconstruire l'onglet Progression après un achat
  private progressionPanelWidth: number = 0;
  private progressionPanelHeight: number = 0;

  constructor() {
    super("MenuOverlayScene");
    this.currentTab = "map";
    this.mapOffsetX = 0;
    this.mapOffsetY = 0;
    this.bestiaryIndex = 0;
    this.upgradeIndex = 0;
  }

  init(data: MenuOverlayData) {
    this.parentSceneKey = data.parentSceneKey;
    this.world = data.world;
    // Onglet par défaut intelligent : si on est à la base, on ouvre sur Progression
    // (c'est *là* qu'on achète). En jeu, on ouvre sur Carte.
    this.currentTab = this.world ? "map" : "progression";
    this.mapOffsetX = 0;
    this.mapOffsetY = 0;
    this.bestiaryIndex = 0;
    this.upgradeIndex = 0;
  }

  create() {
    const { width, height } = this.scale;

    this.rootContainer = this.add.container(0, 0).setDepth(0);

    const overlay = this.add
      .rectangle(0, 0, width, height, COLOR_BG, COLOR_BG_ALPHA)
      .setOrigin(0)
      .setInteractive();
    this.rootContainer.add(overlay);

    const panelWidth = Math.min(width - 60, 800);
    const panelHeight = Math.min(height - 60, 540);
    const panelX = width / 2 - panelWidth / 2;
    const panelY = height / 2 - panelHeight / 2;

    this.progressionPanelWidth = panelWidth - 40;
    this.progressionPanelHeight = panelHeight - 140;

    const border = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, COLOR_PANEL_BORDER).setOrigin(0);
    const panel = this.add.rectangle(panelX + 2, panelY + 2, panelWidth - 4, panelHeight - 4, COLOR_PANEL).setOrigin(0);
    this.rootContainer.add(border);
    this.rootContainer.add(panel);

    this.add
      .text(width / 2, panelY + 20, "MENU", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: COLOR_TITLE,
      })
      .setOrigin(0.5, 0.5);

    this.createTabs(panelX, panelY + 50, panelWidth);

    const contentY = panelY + 100;
    this.tabContainers = {
      map: this.add.container(panelX + 20, contentY),
      inventory: this.add.container(panelX + 20, contentY),
      bestiary: this.add.container(panelX + 20, contentY),
      progression: this.add.container(panelX + 20, contentY),
      stats: this.add.container(panelX + 20, contentY),
    };
    for (const tab of TAB_ORDER) {
      this.rootContainer.add(this.tabContainers[tab]);
    }

    this.buildMapTab(panelWidth - 40, panelHeight - 140);
    this.buildInventoryTab(panelWidth - 40, panelHeight - 140);
    this.buildBestiaryTab(panelWidth - 40, panelHeight - 140);
    this.buildProgressionTab();
    this.buildStatsTab();

    this.add
      .text(
        width / 2,
        panelY + panelHeight - 18,
        "[Tab/←→] onglet  ·  [P/Echap] fermer  ·  [↑↓] naviguer  ·  [Entrée] valider",
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: COLOR_TEXT_DIM,
        }
      )
      .setOrigin(0.5, 0.5);

    this.showCurrentTab();

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
  }

  private createTabs(panelX: number, y: number, panelWidth: number) {
    this.tabLabels = {} as Record<Tab, Phaser.GameObjects.Text>;
    const tabWidth = (panelWidth - 40) / TAB_ORDER.length;
    const startX = panelX + 20;

    TAB_ORDER.forEach((tab, i) => {
      const x = startX + i * tabWidth;
      const bg = this.add
        .rectangle(x, y, tabWidth - 4, 32, COLOR_TAB_INACTIVE)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => this.setTab(tab));

      const label = this.add
        .text(x + tabWidth / 2 - 2, y + 16, TAB_LABELS[tab], {
          fontFamily: "monospace",
          fontSize: "13px",
          color: COLOR_TEXT,
        })
        .setOrigin(0.5);

      this.rootContainer.add(bg);
      this.rootContainer.add(label);
      this.tabLabels[tab] = label;
      (label as Phaser.GameObjects.Text & { _bg: Phaser.GameObjects.Rectangle })._bg = bg;
    });
  }

  private setTab(tab: Tab) {
    this.currentTab = tab;
    this.showCurrentTab();
  }

  private showCurrentTab() {
    for (const tab of TAB_ORDER) {
      this.tabContainers[tab].setVisible(tab === this.currentTab);
      const label = this.tabLabels[tab];
      const bg = (label as Phaser.GameObjects.Text & { _bg: Phaser.GameObjects.Rectangle })._bg;
      if (tab === this.currentTab) {
        bg.setFillStyle(COLOR_TAB_ACTIVE);
        label.setColor(COLOR_TITLE);
      } else {
        bg.setFillStyle(COLOR_TAB_INACTIVE);
        label.setColor(COLOR_TEXT);
      }
    }

    if (this.currentTab === "map") this.refreshMap();
    if (this.currentTab === "bestiary") this.refreshBestiary();
    if (this.currentTab === "progression") this.refreshProgression();
    if (this.currentTab === "stats") this.refreshStats();
  }

  // ===== MAP =====

  private mapGraphics?: Phaser.GameObjects.Graphics;
  private mapInfoText?: Phaser.GameObjects.Text;

  private buildMapTab(width: number, height: number) {
    const c = this.tabContainers.map;
    if (!this.world) {
      c.add(this.add.text(width / 2, height / 2,
        "Carte indisponible.\nVa explorer la mine pour la voir.",
        { fontFamily: "monospace", fontSize: "14px", color: COLOR_TEXT_DIM, align: "center" }
      ).setOrigin(0.5));
      return;
    }
    c.add(this.add.text(0, 0, "Carte du donjon", { fontFamily: "monospace", fontSize: "16px", color: COLOR_TITLE }));
    this.mapGraphics = this.add.graphics();
    c.add(this.mapGraphics);
    this.mapInfoText = this.add.text(0, height - 40, "", { fontFamily: "monospace", fontSize: "11px", color: COLOR_TEXT_DIM });
    c.add(this.mapInfoText);
  }

  private refreshMap() {
    if (!this.world || !this.mapGraphics) return;
    this.mapGraphics.clear();
    const offsetY = 30;
    for (let y = this.mapOffsetY; y < MAP_HEIGHT; y++) {
      for (let x = this.mapOffsetX; x < MAP_WIDTH; x++) {
        const drawX = (x - this.mapOffsetX) * MAP_TILE_SIZE;
        const drawY = offsetY + (y - this.mapOffsetY) * MAP_TILE_SIZE;
        const isFloor = this.world.dungeon.tiles[y][x] === TILE_FLOOR;
        const explored = this.world.dungeon.explored[y][x];
        const visible = this.world.fov.isVisible(x, y);
        let color = visible ? (isFloor ? 0x6a6a6a : 0x404040) : explored ? (isFloor ? 0x2a2a2a : 0x161616) : 0x000000;
        this.mapGraphics.fillStyle(color);
        this.mapGraphics.fillRect(drawX, drawY, MAP_TILE_SIZE - 1, MAP_TILE_SIZE - 1);
      }
    }
    const px = (this.world.player.x - this.mapOffsetX) * MAP_TILE_SIZE;
    const py = offsetY + (this.world.player.y - this.mapOffsetY) * MAP_TILE_SIZE;
    this.mapGraphics.fillStyle(0xffeb3b);
    this.mapGraphics.fillRect(px, py, MAP_TILE_SIZE - 1, MAP_TILE_SIZE - 1);
    if (this.world.stairs && this.world.dungeon.explored[this.world.stairs.y][this.world.stairs.x]) {
      const sxPx = (this.world.stairs.x - this.mapOffsetX) * MAP_TILE_SIZE;
      const syPx = offsetY + (this.world.stairs.y - this.mapOffsetY) * MAP_TILE_SIZE;
      this.mapGraphics.fillStyle(0x4caf50);
      this.mapGraphics.fillRect(sxPx, syPx, MAP_TILE_SIZE - 1, MAP_TILE_SIZE - 1);
    }
    if (this.mapInfoText) {
      this.mapInfoText.setText(`Étage ${this.world.currentLevel}  ·  Position : ${this.world.player.x},${this.world.player.y}  ·  Scroll : ↑↓←→  ·  [Espace] recentrer`);
    }
  }

  // ===== INVENTORY =====

  private buildInventoryTab(width: number, height: number) {
    const c = this.tabContainers.inventory;
    c.add(this.add.text(0, 0, "Inventaire détaillé", { fontFamily: "monospace", fontSize: "16px", color: COLOR_TITLE }));
    if (!this.world) {
      c.add(this.add.text(width / 2, height / 2, "Inventaire vide.", { fontFamily: "monospace", fontSize: "14px", color: COLOR_TEXT_DIM }).setOrigin(0.5));
      return;
    }
    const inventory = this.world.player.inventory;
    const equipped = this.world.player.equippedWeapon;
    if (inventory.length === 0) {
      c.add(this.add.text(0, 50, "(L'inventaire est vide)", { fontFamily: "monospace", fontSize: "13px", color: COLOR_TEXT_DIM }));
    } else {
      let lineY = 50;
      const lineHeight = 70;
      inventory.forEach((item: Item, i) => {
        const icon = getItemIcon(item.name, item.glyph);
        const isEquipped = item === equipped;
        const description = getItemDescription(item.name);
        c.add(this.add.text(0, lineY, icon, { fontFamily: "monospace", fontSize: "32px" }));
        const slotLetter = String.fromCharCode(97 + i);
        c.add(this.add.text(50, lineY, `[${slotLetter}] ${item.name}${isEquipped ? " (équipé)" : ""}`,
          { fontFamily: "monospace", fontSize: "14px", color: isEquipped ? COLOR_TITLE : COLOR_TEXT }));
        c.add(this.add.text(50, lineY + 22, description, { fontFamily: "monospace", fontSize: "11px", color: COLOR_TEXT_DIM, wordWrap: { width: width - 60 } }));
        lineY += lineHeight;
      });
    }
    if (this.world.gameMode === "campaign") {
      const persistent = loadCobalt();
      const total = persistent + this.world.cobaltCollected;
      c.add(this.add.text(0, height - 80, `💎 Cobalt total : ${total}`, { fontFamily: "monospace", fontSize: "14px", color: COLOR_COBALT }));
      c.add(this.add.text(0, height - 60, `   (Run : ${this.world.cobaltCollected}  ·  Sécurisé : ${persistent})`, { fontFamily: "monospace", fontSize: "11px", color: COLOR_TEXT_DIM }));
    }
  }

  // ===== BESTIARY =====

  private bestiaryDetailContainer?: Phaser.GameObjects.Container;
  private bestiaryListItems: Phaser.GameObjects.Text[] = [];

  private buildBestiaryTab(width: number, _height: number) {
    const c = this.tabContainers.bestiary;
    c.add(this.add.text(0, 0, "Bestiaire", { fontFamily: "monospace", fontSize: "16px", color: COLOR_TITLE }));
    const listWidth = 200;
    const detailX = listWidth + 20;
    this.bestiaryListItems = [];
    let listY = 50;
    MONSTER_CATALOG.forEach((_monster, i) => {
      const item = this.add.text(0, listY, "", { fontFamily: "monospace", fontSize: "14px", color: COLOR_TEXT }).setInteractive({ useHandCursor: true });
      item.on("pointerdown", () => { this.bestiaryIndex = i; this.refreshBestiary(); });
      c.add(item);
      this.bestiaryListItems.push(item);
      listY += 30;
    });
    this.bestiaryDetailContainer = this.add.container(detailX, 50);
    c.add(this.bestiaryDetailContainer);
  }

  private refreshBestiary() {
    const killed = loadKilledMonsters();
    this.bestiaryListItems.forEach((item, i) => {
      const monster = MONSTER_CATALOG[i];
      const isKnown = killed.has(monster.kind);
      const isSelected = i === this.bestiaryIndex;
      item.setText(`${isSelected ? "▶ " : "  "}${monster.icon}  ${isKnown ? monster.name : "???"}`);
      item.setColor(!isKnown ? COLOR_LOCKED : isSelected ? COLOR_TITLE : COLOR_TEXT);
    });
    if (!this.bestiaryDetailContainer) return;
    this.bestiaryDetailContainer.removeAll(true);
    const monster = MONSTER_CATALOG[this.bestiaryIndex];
    if (!killed.has(monster.kind)) {
      this.bestiaryDetailContainer.add(this.add.text(0, 0, "???", { fontFamily: "monospace", fontSize: "32px", color: COLOR_LOCKED }));
      this.bestiaryDetailContainer.add(this.add.text(0, 50, "Tu n'as encore jamais vaincu cette créature.\n\nReviens consulter le bestiaire après en avoir tué une.", { fontFamily: "monospace", fontSize: "13px", color: COLOR_TEXT_DIM, wordWrap: { width: 380 } }));
      return;
    }
    this.bestiaryDetailContainer.add(this.add.text(0, 0, monster.icon, { fontFamily: "monospace", fontSize: "48px" }));
    this.bestiaryDetailContainer.add(this.add.text(70, 10, monster.name, { fontFamily: "monospace", fontSize: "20px", color: COLOR_TITLE }));
    this.bestiaryDetailContainer.add(this.add.text(70, 38, `Glyphe : ${monster.glyph}`, { fontFamily: "monospace", fontSize: "11px", color: COLOR_TEXT_DIM }));
    this.bestiaryDetailContainer.add(this.add.text(0, 80, `PV : ${monster.stats.hp}    ATK : ${monster.stats.attack}    DEF : ${monster.stats.defense}    Vitesse : ${monster.stats.speed}`, { fontFamily: "monospace", fontSize: "13px", color: COLOR_TEXT }));
    this.bestiaryDetailContainer.add(this.add.text(0, 120, monster.description, { fontFamily: "monospace", fontSize: "12px", color: COLOR_TEXT_DIM, wordWrap: { width: 380 } }));
  }

  // ===== PROGRESSION =====

  private progressionContainer?: Phaser.GameObjects.Container;
  private feedbackText?: Phaser.GameObjects.Text;

  private buildProgressionTab() {
    const c = this.tabContainers.progression;
    c.add(this.add.text(0, 0, "Progression — Améliorations", { fontFamily: "monospace", fontSize: "16px", color: COLOR_TITLE }));

    // Container reconstruit à chaque refresh (donc à chaque achat)
    this.progressionContainer = this.add.container(0, 30);
    c.add(this.progressionContainer);

    // Texte de feedback (succès/échec d'achat)
    this.feedbackText = this.add.text(0, this.progressionPanelHeight - 30, "", { fontFamily: "monospace", fontSize: "12px", color: COLOR_OK });
    c.add(this.feedbackText);
  }

  // Reconstruit entièrement la liste des upgrades. Appelé à chaque ouverture
  // de l'onglet et à chaque achat (pour refléter le changement de cobalt).
  private refreshProgression() {
    if (!this.progressionContainer) return;
    this.progressionContainer.removeAll(true);

    const cobalt = loadCobalt();
    const unlocked = loadUnlockedUpgrades();

    // En-tête : si on est ailleurs qu'à la base, on indique qu'on ne peut
    // pas acheter ici.
    const isAtBase = this.parentSceneKey === "BaseScene";
    if (!isAtBase) {
      this.progressionContainer.add(this.add.text(0, 0,
        "💡 Les améliorations ne peuvent être achetées qu'à la base.\n   Reviens-y entre les expéditions.",
        { fontFamily: "monospace", fontSize: "12px", color: COLOR_TEXT_DIM }
      ));
    }

    // Compteur cobalt
    this.progressionContainer.add(this.add.text(0, isAtBase ? 0 : 40,
      `💎 Cobalt disponible : ${cobalt}`,
      { fontFamily: "monospace", fontSize: "14px", color: COLOR_COBALT }
    ));

    // Affiche les upgrades groupées par catégorie
    const startY = isAtBase ? 30 : 70;
    const categories: { id: UpgradeCategory; label: string }[] = [
      { id: "combat", label: "── Combat ──" },
      { id: "exploration", label: "── Exploration ──" },
    ];

    let y = startY;
    let displayedItems = 0;

    for (const cat of categories) {
      const upgradesInCat = UPGRADES_CATALOG.filter((u) => u.category === cat.id);
      if (upgradesInCat.length === 0) continue;

      this.progressionContainer.add(this.add.text(0, y, cat.label,
        { fontFamily: "monospace", fontSize: "13px", color: COLOR_TITLE }
      ));
      y += 24;

      for (const upgrade of upgradesInCat) {
        const isUnlocked = unlocked.has(upgrade.id);
        const check = checkRequirements(upgrade);
        const isSelected = displayedItems === this.upgradeIndex;

        this.renderUpgradeRow(upgrade, y, isSelected, isUnlocked, check, isAtBase);
        y += 80;
        displayedItems++;
      }
      y += 10;
    }
  }

  // Affiche une ligne d'upgrade : icône, nom, statut, exigences, description
  private renderUpgradeRow(
    upgrade: Upgrade,
    y: number,
    isSelected: boolean,
    isUnlocked: boolean,
    check: ReturnType<typeof checkRequirements>,
    isAtBase: boolean
  ) {
    if (!this.progressionContainer) return;

    // Indicateur de sélection
    if (isSelected) {
      this.progressionContainer.add(this.add.text(0, y + 4, "▶", { fontFamily: "monospace", fontSize: "14px", color: COLOR_TITLE }));
    }

    // Icône
    this.progressionContainer.add(this.add.text(20, y, upgrade.icon, { fontFamily: "monospace", fontSize: "26px" }));

    // Nom + statut
    let statusText = "";
    let statusColor = COLOR_TEXT;
    if (isUnlocked) {
      statusText = "  ✓ Débloqué";
      statusColor = COLOR_OK;
    } else if (!isAtBase) {
      statusText = "  (à la base)";
      statusColor = COLOR_TEXT_DIM;
    } else if (check.allOk) {
      statusText = "  [Entrée] Acheter";
      statusColor = COLOR_OK;
    } else {
      statusText = "  Verrouillé";
      statusColor = COLOR_NOT_OK;
    }

    this.progressionContainer.add(this.add.text(60, y, upgrade.name + statusText, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: isSelected && !isUnlocked ? COLOR_TITLE : statusColor,
    }));

    // Exigences (avec couleur selon si chacune est remplie)
    const reqs: { text: string; ok: boolean }[] = [];
    reqs.push({ text: `${upgrade.requirements.cobalt} 💎`, ok: check.cobaltOk });
    if (upgrade.requirements.totalKills !== undefined) {
      reqs.push({ text: `${upgrade.requirements.totalKills} kills`, ok: check.killsOk });
    }
    if (upgrade.requirements.totalDeaths !== undefined) {
      reqs.push({ text: `${upgrade.requirements.totalDeaths} morts`, ok: check.deathsOk });
    }

    if (!isUnlocked) {
      let reqX = 60;
      for (const req of reqs) {
        const t = this.add.text(reqX, y + 22, req.text, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: req.ok ? COLOR_OK : COLOR_NOT_OK,
        });
        this.progressionContainer.add(t);
        reqX += t.width + 14;
      }
    }

    // Description
    this.progressionContainer.add(this.add.text(60, y + 42, upgrade.description, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: COLOR_TEXT_DIM,
      wordWrap: { width: this.progressionPanelWidth - 80 },
    }));
  }

  // Tente l'achat de l'upgrade sélectionnée. Met à jour l'UI et un feedback.
  private tryPurchaseSelected() {
    if (this.parentSceneKey !== "BaseScene") {
      this.showFeedback("Reviens à la base pour acheter une amélioration.", false);
      return;
    }

    const upgrade = this.getUpgradeAtIndex(this.upgradeIndex);
    if (!upgrade) return;

    if (loadUnlockedUpgrades().has(upgrade.id)) {
      this.showFeedback("Déjà débloqué.", false);
      return;
    }

    const ok = purchase(upgrade);
    if (ok) {
      this.showFeedback(`${upgrade.name} débloqué ! L'effet s'appliquera à la prochaine expédition.`, true);
      this.refreshProgression();
    } else {
      this.showFeedback("Conditions non remplies.", false);
    }
  }

  // Récupère l'upgrade à l'index N en respectant l'ordre par catégorie d'affichage.
  private getUpgradeAtIndex(index: number): Upgrade | undefined {
    const ordered: Upgrade[] = [];
    for (const cat of ["combat", "exploration"] as UpgradeCategory[]) {
      ordered.push(...UPGRADES_CATALOG.filter((u) => u.category === cat));
    }
    return ordered[index];
  }

  private getTotalUpgradeCount(): number {
    return UPGRADES_CATALOG.length;
  }

  private showFeedback(message: string, isOk: boolean) {
    if (!this.feedbackText) return;
    this.feedbackText.setText(message);
    this.feedbackText.setColor(isOk ? COLOR_OK : COLOR_NOT_OK);
    this.time.delayedCall(3000, () => this.feedbackText?.setText(""));
  }

  // ===== STATS =====

  private statsContainer?: Phaser.GameObjects.Container;

  private buildStatsTab() {
    const c = this.tabContainers.stats;
    c.add(this.add.text(0, 0, "Statistiques globales", { fontFamily: "monospace", fontSize: "16px", color: COLOR_TITLE }));
    this.statsContainer = this.add.container(0, 40);
    c.add(this.statsContainer);
  }

  private refreshStats() {
    if (!this.statsContainer) return;
    this.statsContainer.removeAll(true);

    const cobalt = loadCobalt();
    const kills = loadTotalKills();
    const deaths = loadTotalDeaths();
    const killed = loadKilledMonsters();
    const unlocked = loadUnlockedUpgrades();

    const lines: { icon: string; label: string; value: string }[] = [
      { icon: "💎", label: "Cobalt sécurisé", value: `${cobalt}` },
      { icon: "⚔", label: "Ennemis tués (toutes runs)", value: `${kills}` },
      { icon: "💀", label: "Nombre de morts", value: `${deaths}` },
      { icon: "📖", label: "Espèces du bestiaire", value: `${killed.size} / ${MONSTER_CATALOG.length}` },
      { icon: "✦", label: "Améliorations débloquées", value: `${unlocked.size} / ${UPGRADES_CATALOG.length}` },
    ];

    let y = 0;
    for (const line of lines) {
      this.statsContainer.add(this.add.text(0, y, line.icon, { fontFamily: "monospace", fontSize: "20px" }));
      this.statsContainer.add(this.add.text(36, y + 4, line.label, { fontFamily: "monospace", fontSize: "13px", color: COLOR_TEXT }));
      this.statsContainer.add(this.add.text(380, y + 4, line.value, { fontFamily: "monospace", fontSize: "13px", color: COLOR_TITLE }));
      y += 36;
    }

    // Ratio K/D si pertinent
    if (deaths > 0) {
      const kd = (kills / deaths).toFixed(2);
      y += 16;
      this.statsContainer.add(this.add.text(0, y, `Ratio K/D : ${kd}`, { fontFamily: "monospace", fontSize: "12px", color: COLOR_TEXT_DIM }));
    }
  }

  // ===== INPUTS =====

  private handleKeyDown(event: KeyboardEvent) {
    if (event.key === "p" || event.key === "P" || event.key === "Escape") {
      this.closeMenu();
      return;
    }

    if (event.key === "Tab") {
      const idx = TAB_ORDER.indexOf(this.currentTab);
      const next = TAB_ORDER[(idx + 1) % TAB_ORDER.length];
      this.setTab(next);
      event.preventDefault?.();
      return;
    }

    if (this.currentTab === "map") this.handleMapKeys(event);
    else if (this.currentTab === "bestiary") this.handleBestiaryKeys(event);
    else if (this.currentTab === "progression") this.handleProgressionKeys(event);
    // L'onglet stats n'a pas d'inputs spécifiques (statique)
    // Pour les autres, gauche/droite change d'onglet (cohérent)
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const idx = TAB_ORDER.indexOf(this.currentTab);
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = TAB_ORDER[(idx + delta + TAB_ORDER.length) % TAB_ORDER.length];
      this.setTab(next);
    }
  }

  private handleMapKeys(event: KeyboardEvent) {
    let scrolled = false;
    switch (event.key) {
      case "ArrowLeft":  this.mapOffsetX = Math.max(0, this.mapOffsetX - MAP_SCROLL_STEP); scrolled = true; break;
      case "ArrowRight": this.mapOffsetX = Math.min(MAP_WIDTH - 1, this.mapOffsetX + MAP_SCROLL_STEP); scrolled = true; break;
      case "ArrowUp":    this.mapOffsetY = Math.max(0, this.mapOffsetY - MAP_SCROLL_STEP); scrolled = true; break;
      case "ArrowDown":  this.mapOffsetY = Math.min(MAP_HEIGHT - 1, this.mapOffsetY + MAP_SCROLL_STEP); scrolled = true; break;
      case " ":
        if (this.world) {
          this.mapOffsetX = Math.max(0, this.world.player.x - 15);
          this.mapOffsetY = Math.max(0, this.world.player.y - 10);
        }
        scrolled = true;
        break;
    }
    if (scrolled) this.refreshMap();
  }

  private handleBestiaryKeys(event: KeyboardEvent) {
    if (event.key === "ArrowUp") {
      this.bestiaryIndex = Math.max(0, this.bestiaryIndex - 1);
      this.refreshBestiary();
    } else if (event.key === "ArrowDown") {
      this.bestiaryIndex = Math.min(MONSTER_CATALOG.length - 1, this.bestiaryIndex + 1);
      this.refreshBestiary();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const idx = TAB_ORDER.indexOf(this.currentTab);
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = TAB_ORDER[(idx + delta + TAB_ORDER.length) % TAB_ORDER.length];
      this.setTab(next);
    }
  }

  private handleProgressionKeys(event: KeyboardEvent) {
    if (event.key === "ArrowUp") {
      this.upgradeIndex = Math.max(0, this.upgradeIndex - 1);
      this.refreshProgression();
    } else if (event.key === "ArrowDown") {
      this.upgradeIndex = Math.min(this.getTotalUpgradeCount() - 1, this.upgradeIndex + 1);
      this.refreshProgression();
    } else if (event.key === "Enter") {
      this.tryPurchaseSelected();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const idx = TAB_ORDER.indexOf(this.currentTab);
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = TAB_ORDER[(idx + delta + TAB_ORDER.length) % TAB_ORDER.length];
      this.setTab(next);
    }
  }

  private closeMenu() {
    this.scene.resume(this.parentSceneKey);
    this.scene.stop();
  }
}