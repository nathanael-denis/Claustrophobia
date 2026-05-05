// src/scenes/SplashScene.ts
// Première scène : logo du studio. Reste affichée jusqu'à ce que
// l'utilisateur interagisse (clic ou touche). C'est ce qui déverrouille
// aussi l'audio du navigateur, garantissant que la musique du menu
// puisse démarrer dès l'arrivée sur MenuScene.

import * as Phaser from "phaser";

const FADE_OUT_MS = 600;

export class SplashScene extends Phaser.Scene {
  private hasTransitioned: boolean;

  constructor() {
    super("SplashScene");
    this.hasTransitioned = false;
  }

  create() {
    this.hasTransitioned = false;

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#0a0a0a");
    this.cameras.main.fadeIn(500, 0, 0, 0);

    const frogAscii = [
      "       _____   _____",
      "      /     \\_/     \\",
      "     |  (o)     (o)  |",
      "     |       v       |",
      "      \\___---------_/",
      "        /         \\",
      "       /           \\",
      "      |   CORROFROG  |",
      "       \\___________/",
    ].join("\n");

    this.add
      .text(width / 2, height / 2 - 60, frogAscii, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#3d6b3d",
        align: "center",
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(width / 2, height / 2 + 80, "CORROFROG", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#ffeb3b",
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(width / 2, height / 2 + 120, "── ENTERTAINMENT ──", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#888888",
      })
      .setOrigin(0.5, 0.5);

    // Hint plus visible : appuyer pour continuer (plus de transition auto)
    const hint = this.add
      .text(width / 2, height - 40, "▼  Appuie sur une touche pour continuer  ▼", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#888888",
      })
      .setOrigin(0.5, 0.5);

    // Petit effet de pulsation pour attirer le regard sur le hint
    this.tweens.add({
      targets: hint,
      alpha: 0.3,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.input.keyboard?.on("keydown", () => this.transitionToMenu());
    this.input.on("pointerdown", () => this.transitionToMenu());
  }

  private transitionToMenu() {
    if (this.hasTransitioned) return;
    this.hasTransitioned = true;

    this.cameras.main.fadeOut(FADE_OUT_MS, 0, 0, 0);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        this.scene.start("MenuScene");
      }
    );
  }
}