// src/scenes/MenuScene.ts
import * as Phaser from "phaser";
import { createButton } from "../ui/Button";
import { AudioManager } from "../systems/AudioManager";

const MUSIC_KEY = "menu-theme";
const MUSIC_PATH = "audio/menu-theme.mp3";
const MUSIC_VOLUME = 0.5;

export class MenuScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;
  private music?: Phaser.Sound.BaseSound;
  private audio!: AudioManager;
  private isTransitioning: boolean;

  constructor() {
    super("MenuScene");
    this.isTransitioning = false;
  }

  preload() {
    if (!this.cache.audio.exists(MUSIC_KEY)) {
      this.load.audio(MUSIC_KEY, MUSIC_PATH);
    }
    // L'AudioManager pré-charge aussi tous les SFX y compris le gong, comme ça
    // il est dispo quand on clique "Nouvelle partie".
    this.audio = new AudioManager(this);
    this.audio.preloadAll();
  }

  create() {
    this.isTransitioning = false;

    const { width, height } = this.scale;

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.cameras.main.setBackgroundColor("#0a0a0a");

    const leftWidth = Math.floor(width * 0.65);
    this.add.rectangle(0, 0, leftWidth, height, 0x141414).setOrigin(0, 0);

    this.add
      .text(leftWidth / 2, height / 2 - 60, "CLAUSTROPHOBIA", {
        fontFamily: "monospace",
        fontSize: "42px",
        color: "#ffeb3b",
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(leftWidth / 2, height / 2 - 10, "── un roguelike ──", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#888888",
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(
        leftWidth / 2,
        height / 2 + 60,
        [
          "###########",
          "#.........#",
          "#...@.....#",
          "#.....g...#",
          "#.........#",
          "###########",
        ].join("\n"),
        {
          fontFamily: "monospace",
          fontSize: "20px",
          color: "#444444",
          align: "center",
        }
      )
      .setOrigin(0.5, 0.5);

    const panelX = leftWidth + (width - leftWidth) / 2;
    const buttonSpacing = 56;
    // 4 boutons donc on commence un peu plus haut pour que ça reste centré
    let buttonY = height / 2 - buttonSpacing * 1.5;

    createButton(this, panelX, buttonY, "Nouvelle partie", {
      width: 220,
      onClick: () => this.startCampaign(),
    });
    buttonY += buttonSpacing;

    createButton(this, panelX, buttonY, "Arcade", {
      width: 220,
      onClick: () => this.startArcade(),
    });
    buttonY += buttonSpacing;

    createButton(this, panelX, buttonY, "Charger partie", {
      width: 220,
      onClick: () => this.showStatus("Sauvegardes : bientôt disponible"),
    });
    buttonY += buttonSpacing;

    createButton(this, panelX, buttonY, "Paramètres", {
      width: 220,
      onClick: () => this.showStatus("Paramètres : bientôt disponible"),
    });

    this.statusText = this.add
      .text(width / 2, height - 24, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#888888",
      })
      .setOrigin(0.5, 0.5);

    // Entrée = nouvelle partie (campagne, le mode "principal")
    this.input.keyboard?.on("keydown-ENTER", () => this.startCampaign());

    this.startMusic();
  }

  private startMusic() {
    if (!this.cache.audio.exists(MUSIC_KEY)) {
      console.warn(`Musique introuvable : ${MUSIC_PATH}`);
      return;
    }

    this.music = this.sound.add(MUSIC_KEY, {
      loop: true,
      volume: MUSIC_VOLUME,
    });

    this.music.play();

    if (this.sound.locked) {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
        if (this.music && !this.music.isPlaying) {
          this.music.play();
        }
      });
    }
  }

  private stopMusic() {
    if (this.music) {
      this.music.stop();
      this.music.destroy();
      this.music = undefined;
    }
  }

  // Mode campagne : passe par la base. Joue un gong puis transitionne.
  private startCampaign() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // Gong
    this.audio.play("gong");

    // Petite pause pour laisser le gong s'exprimer avant de transitioner.
    // Si pas de fichier gong, c'est juste une pause de 600ms (pas dramatique).
    this.time.delayedCall(600, () => {
      this.stopMusic();
      this.cameras.main.fadeOut(700, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("BaseScene");
      });
    });
  }

  // Mode arcade : direct dans la mine, comportement historique.
  private startArcade() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.stopMusic();
    this.scene.start("GameScene");
  }

  private showStatus(message: string) {
    if (!this.statusText) return;
    this.statusText.setText(message);
    this.time.delayedCall(2000, () => {
      this.statusText?.setText("");
    });
  }
}