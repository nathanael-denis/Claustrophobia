// src/scenes/BuildingScene.ts
// Placeholder pour le bâtiment Nord. Pour l'instant juste une pièce vide
// avec un message — tu décideras de son usage plus tard (PNJ, marchand,
// archive narrative, etc.).

import * as Phaser from "phaser";

export class BuildingScene extends Phaser.Scene {
  constructor() {
    super("BuildingScene");
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.cameras.main.setBackgroundColor("#1a1a1a");

    this.add
      .text(width / 2, height / 2 - 40, "── BÂTIMENT ──", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffeb3b",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height / 2 + 10,
        "L'intérieur est sombre et silencieux.\nIl n'y a personne pour l'instant.",
        {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#aaaaaa",
          align: "center",
        }
      )
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 40, "[Echap] Sortir", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#888888",
      })
      .setOrigin(0.5);

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.start("BaseScene");
        });
      }
    });
  }
}