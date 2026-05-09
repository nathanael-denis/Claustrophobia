// src/ui/ConfirmDialog.ts
// Popup modale de confirmation (Oui/Non).
// Crée un overlay sombre, une boîte centrale avec un message, et deux boutons.
// Renvoie un objet contrôlable pour fermer la popup, mais l'usage normal
// passe par les callbacks onConfirm / onCancel.

import * as Phaser from "phaser";
import { createButton } from "./Button";

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string; // défaut : "Confirmer"
  cancelLabel?: string;  // défaut : "Annuler"
  onConfirm: () => void;
  onCancel?: () => void;
}

// Crée et affiche une popup de confirmation centrée dans la scène.
// Renvoie le container racine (utile pour la détruire manuellement si besoin).
export function showConfirmDialog(
  scene: Phaser.Scene,
  options: ConfirmDialogOptions
): Phaser.GameObjects.Container {
  const { width, height } = scene.scale;

  // Container racine pour pouvoir tout détruire d'un coup.
  // Profondeur 1000 = au-dessus de tout le reste.
  const root = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);

  // Overlay sombre semi-transparent qui couvre tout l'écran et
  // bloque les clics sur ce qui est derrière.
  const overlay = scene.add
    .rectangle(0, 0, width, height, 0x000000, 0.7)
    .setOrigin(0, 0)
    .setInteractive(); // capture les clics pour empêcher d'interagir avec ce qui est derrière
  root.add(overlay);

  // Boîte centrale
  const boxWidth = 480;
  const boxHeight = 220;
  const boxX = width / 2;
  const boxY = height / 2;

  const border = scene.add.rectangle(boxX, boxY, boxWidth, boxHeight, 0x666666);
  const box = scene.add.rectangle(boxX, boxY, boxWidth - 4, boxHeight - 4, 0x1a1a1a);
  root.add(border);
  root.add(box);

  // Titre
  const title = scene.add
    .text(boxX, boxY - 70, options.title, {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffeb3b",
    })
    .setOrigin(0.5);
  root.add(title);

  // Message (peut être multi-ligne)
  const message = scene.add
    .text(boxX, boxY - 20, options.message, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#cccccc",
      align: "center",
      wordWrap: { width: boxWidth - 40 },
    })
    .setOrigin(0.5);
  root.add(message);

  // Boutons : on les met en bas, espacés horizontalement
  const buttonY = boxY + 60;
  const buttonSpacing = 130;

  const close = () => {
    root.destroy();
  };

  const cancelBtn = createButton(
    scene,
    boxX - buttonSpacing / 2,
    buttonY,
    options.cancelLabel ?? "Annuler",
    {
      width: 120,
      height: 40,
      onClick: () => {
        close();
        options.onCancel?.();
      },
    }
  );
  root.add(cancelBtn);

  const confirmBtn = createButton(
    scene,
    boxX + buttonSpacing / 2,
    buttonY,
    options.confirmLabel ?? "Confirmer",
    {
      width: 120,
      height: 40,
      onClick: () => {
        close();
        options.onConfirm();
      },
    }
  );
  root.add(confirmBtn);

  return root;
}