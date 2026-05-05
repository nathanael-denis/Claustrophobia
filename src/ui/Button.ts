// src/ui/Button.ts
// Helper pour créer des boutons cliquables avec hover/press states.
// Renvoie un Container Phaser (rectangle + texte groupés) qu'on peut
// positionner et manipuler comme un seul objet.

import * as Phaser from "phaser";

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  enabled?: boolean;
  onClick: () => void;
}

const COLOR_NORMAL = 0x2a2a2a;
const COLOR_HOVER = 0x3d3d3d;
const COLOR_PRESSED = 0x1a1a1a;
const COLOR_DISABLED = 0x1f1f1f;

const TEXT_NORMAL = "#ffffff";
const TEXT_DISABLED = "#666666";

const BORDER_NORMAL = 0x555555;
const BORDER_HOVER = 0xffeb3b;
const BORDER_DISABLED = 0x333333;

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  options: ButtonOptions
): Phaser.GameObjects.Container {
  const width = options.width ?? 200;
  const height = options.height ?? 44;
  const fontSize = options.fontSize ?? 16;
  const enabled = options.enabled ?? true;

  const container = scene.add.container(x, y);

  // Bordure (rectangle plus grand derrière)
  const border = scene.add.rectangle(0, 0, width, height, enabled ? BORDER_NORMAL : BORDER_DISABLED);

  // Fond
  const bg = scene.add.rectangle(
    0,
    0,
    width - 2,
    height - 2,
    enabled ? COLOR_NORMAL : COLOR_DISABLED
  );

  // Label
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: "monospace",
      fontSize: `${fontSize}px`,
      color: enabled ? TEXT_NORMAL : TEXT_DISABLED,
    })
    .setOrigin(0.5, 0.5);

  container.add([border, bg, text]);

  if (!enabled) {
    return container;
  }

  // Zone interactive (sur le fond)
  bg.setInteractive({ useHandCursor: true });

  bg.on("pointerover", () => {
    bg.setFillStyle(COLOR_HOVER);
    border.setFillStyle(BORDER_HOVER);
  });
  bg.on("pointerout", () => {
    bg.setFillStyle(COLOR_NORMAL);
    border.setFillStyle(BORDER_NORMAL);
  });
  bg.on("pointerdown", () => {
    bg.setFillStyle(COLOR_PRESSED);
  });
  bg.on("pointerup", () => {
    bg.setFillStyle(COLOR_HOVER);
    options.onClick();
  });

  return container;
}