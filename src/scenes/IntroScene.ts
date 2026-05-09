// src/scenes/IntroScene.ts
// Cinématique d'intro : 4 images en plein écran, chacune avec un mouvement
// caméra distinct (effet Ken Burns), enchaînées par fondu.
//
// Skippable à tout moment via Espace, Échap ou clic.
// Termine vers BaseScene.
//
// Pour modifier les images, leur ordre, ou les mouvements : édite le tableau
// INTRO_FRAMES en haut du fichier. Aucune autre modification nécessaire.

import * as Phaser from "phaser";

// Type de mouvement appliqué à une image pendant son temps d'affichage.
// Tous les mouvements partent d'un état initial et glissent vers un état final
// pendant la totalité de la durée de l'image. Chaque "mouvement" est en réalité
// une combinaison position + scale qu'on tween.
type Movement =
  | { kind: "panRight"; intensity?: number }    // glisse vers la droite
  | { kind: "panLeft"; intensity?: number }     // glisse vers la gauche
  | { kind: "panUp"; intensity?: number }       // glisse vers le haut
  | { kind: "panDown"; intensity?: number }     // glisse vers le bas
  | { kind: "zoomIn"; intensity?: number }      // zoom progressif vers l'intérieur
  | { kind: "zoomOut"; intensity?: number };    // dezoom progressif

interface IntroFrame {
  key: string;       // identifiant Phaser
  path: string;      // chemin du fichier
  duration: number;  // durée d'affichage en ms (hors transitions)
  movement: Movement;
  caption?: string;  // texte optionnel à afficher (futur usage)
}

// CONFIGURATION DE LA CINÉMATIQUE
// Édite ce tableau pour changer images, durées, mouvements.
// Chaque image dure ~5s, mouvement distinct par image pour créer du rythme.
const INTRO_FRAMES: IntroFrame[] = [
  {
    key: "intro-01",
    path: "images/intro/intro-01.jpg",
    duration: 5000,
    movement: { kind: "panRight", intensity: 0.08 },
  },
  {
    key: "intro-02",
    path: "images/intro/intro-02.jpg",
    duration: 5000,
    movement: { kind: "zoomOut", intensity: 0.10 },
  },
  {
    key: "intro-03",
    path: "images/intro/intro-03.jpg",
    duration: 5000,
    movement: { kind: "panDown", intensity: 0.08 },
  },
  {
    key: "intro-04",
    path: "images/intro/intro-04.jpg",
    duration: 5000,
    movement: { kind: "zoomIn", intensity: 0.12 },
  },
];

// Durée des fondus entre images (cross-fade). Doit rester courte
// par rapport à la durée des images pour ne pas raccourcir la lecture.
const CROSS_FADE_MS = 800;

// Durée du fondu d'ouverture et de sortie de la cinématique
const FADE_IN_MS = 600;
const FADE_OUT_MS = 700;

export class IntroScene extends Phaser.Scene {
  private currentImage?: Phaser.GameObjects.Image;
  private nextImage?: Phaser.GameObjects.Image;
  private skipText?: Phaser.GameObjects.Text;
  private currentFrameIndex: number;
  private isFinishing: boolean;
  private nextFrameTimer?: Phaser.Time.TimerEvent;
  private activeTweens: Phaser.Tweens.Tween[];

  constructor() {
    super("IntroScene");
    this.currentFrameIndex = 0;
    this.isFinishing = false;
    this.activeTweens = [];
  }

  preload() {
    // Charge toutes les images de l'intro
    for (const frame of INTRO_FRAMES) {
      if (!this.textures.exists(frame.key)) {
        this.load.image(frame.key, frame.path);
      }
    }

    // Si une image manque, on log mais on continue (la cinématique
    // affichera juste un écran noir pour cette image)
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.warn(`Image d'intro manquante : ${file.url}`);
    });
  }

  create() {
    this.currentFrameIndex = 0;
    this.isFinishing = false;
    this.activeTweens = [];

    this.cameras.main.setBackgroundColor("#000000");
    this.cameras.main.fadeIn(FADE_IN_MS, 0, 0, 0);

    // Texte de skip discret en bas à droite
    this.skipText = this.add
      .text(
        this.scale.width - 16,
        this.scale.height - 16,
        "[Espace] passer",
        {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#888888",
        }
      )
      .setOrigin(1, 1)
      .setDepth(100)
      .setAlpha(0);

    // Apparition douce du texte de skip après le fade-in
    this.tweens.add({
      targets: this.skipText,
      alpha: 0.8,
      duration: 400,
      delay: FADE_IN_MS,
    });

    // Inputs de skip
    this.input.keyboard?.on("keydown-SPACE", () => this.finish());
    this.input.keyboard?.on("keydown-ESC", () => this.finish());
    this.input.keyboard?.on("keydown-ENTER", () => this.finish());
    this.input.on("pointerdown", () => this.finish());

    // Démarrer la première image
    this.showFrame(0);
  }

  private showFrame(index: number) {
    if (this.isFinishing) return;
    if (index >= INTRO_FRAMES.length) {
      this.finish();
      return;
    }

    this.currentFrameIndex = index;
    const frame = INTRO_FRAMES[index];

    // Si la texture n'a pas pu charger, on saute cette image
    if (!this.textures.exists(frame.key)) {
      console.warn(`Texture absente, on passe à la suivante : ${frame.key}`);
      this.scheduleNextFrame(frame.duration);
      return;
    }

    // Crée la nouvelle image en l'ajustant pour couvrir tout l'écran (cover)
    const img = this.createCoveringImage(frame.key);
    img.setAlpha(0);

    // Crossfade : on fade out l'ancienne, fade in la nouvelle, en parallèle.
    // Pour la première image, il n'y a pas d'ancienne donc seul le fadein joue.
    const oldImage = this.currentImage;
    this.currentImage = img;

    this.tweens.add({
      targets: img,
      alpha: 1,
      duration: CROSS_FADE_MS,
    });

    if (oldImage) {
      this.tweens.add({
        targets: oldImage,
        alpha: 0,
        duration: CROSS_FADE_MS,
        onComplete: () => oldImage.destroy(),
      });
    }

    // Lance le mouvement Ken Burns sur cette image
    this.applyMovement(img, frame.movement, frame.duration);

    // Programme la transition vers l'image suivante
    this.scheduleNextFrame(frame.duration);
  }

  // Crée une image affichée en mode "cover" : redimensionnée pour remplir
  // entièrement la viewport, en conservant le ratio (peut couper sur les bords).
  // Le scale de base est calculé pour que l'image couvre exactement l'écran.
  private createCoveringImage(key: string): Phaser.GameObjects.Image {
    const { width, height } = this.scale;
    const image = this.add.image(width / 2, height / 2, key);
    image.setOrigin(0.5, 0.5);

    // Calcul du scale pour couvrir : le plus grand des deux ratios
    const texture = this.textures.get(key).getSourceImage();
    const texWidth = texture.width;
    const texHeight = texture.height;
    const scaleX = width / texWidth;
    const scaleY = height / texHeight;
    const baseScale = Math.max(scaleX, scaleY);

    // On stocke le scale "de base" en data sur l'objet pour pouvoir
    // l'utiliser comme point de départ du tween de mouvement
    image.setScale(baseScale);
    image.setData("baseScale", baseScale);

    return image;
  }

  // Applique le mouvement de caméra (Ken Burns) en tweenant la position
  // et/ou le scale de l'image pendant toute sa durée d'affichage.
  // intensity : amplitude du mouvement (0.05 = subtil, 0.15 = marqué).
  private applyMovement(
    image: Phaser.GameObjects.Image,
    movement: Movement,
    duration: number
  ) {
    const { width, height } = this.scale;
    const baseScale = image.getData("baseScale") as number;
    const intensity = movement.intensity ?? 0.08;

    let targetX = image.x;
    let targetY = image.y;
    let targetScale = baseScale;

    switch (movement.kind) {
      case "panRight":
        targetX = image.x - width * intensity;
        // Léger zoom pour que les bords ne rentrent jamais dans le cadre
        targetScale = baseScale * (1 + intensity * 0.5);
        image.setScale(baseScale * (1 + intensity * 0.5));
        targetX = image.x - width * intensity;
        break;
      case "panLeft":
        targetScale = baseScale * (1 + intensity * 0.5);
        image.setScale(baseScale * (1 + intensity * 0.5));
        targetX = image.x + width * intensity;
        break;
      case "panUp":
        targetScale = baseScale * (1 + intensity * 0.5);
        image.setScale(baseScale * (1 + intensity * 0.5));
        targetY = image.y + height * intensity;
        break;
      case "panDown":
        targetScale = baseScale * (1 + intensity * 0.5);
        image.setScale(baseScale * (1 + intensity * 0.5));
        targetY = image.y - height * intensity;
        break;
      case "zoomIn":
        // On démarre au scale de base, on tween vers un scale plus grand
        image.setScale(baseScale);
        targetScale = baseScale * (1 + intensity);
        break;
      case "zoomOut":
        // On démarre zoomé, on tween vers le scale de base
        image.setScale(baseScale * (1 + intensity));
        targetScale = baseScale;
        break;
    }

    const tween = this.tweens.add({
      targets: image,
      x: targetX,
      y: targetY,
      scale: targetScale,
      duration,
      ease: "Linear", // Linéaire = mouvement de caméra constant, sans accélération
    });
    this.activeTweens.push(tween);
  }

  private scheduleNextFrame(currentDuration: number) {
    // Annuler un éventuel timer en cours
    this.nextFrameTimer?.remove();
    this.nextFrameTimer = this.time.delayedCall(currentDuration, () => {
      this.showFrame(this.currentFrameIndex + 1);
    });
  }

  // Termine la cinématique et passe à BaseScene.
  // Idempotent : appelé plusieurs fois (skip + fin naturelle), on ignore les suivants.
  private finish() {
    if (this.isFinishing) return;
    this.isFinishing = true;

    // Stop tous les tweens en cours pour éviter qu'ils continuent pendant le fade
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.nextFrameTimer?.remove();

    this.cameras.main.fadeOut(FADE_OUT_MS, 0, 0, 0);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        this.scene.start("BaseScene");
      }
    );
  }
}