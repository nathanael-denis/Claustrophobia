// src/systems/AudioManager.ts
import * as Phaser from "phaser";
import type { Actor } from "../entities/Actor";

export type SfxCategory =
  | "step"
  | "growl"
  | "scream"
  | "crawl_growl"
  | "crawl_scream"
  | "gong";

interface SfxConfig {
  files: { key: string; path: string }[];
  volume: number;
  minIntervalMs?: number;
  selection?: "random" | "cycle";
}

const SFX_CONFIG: Record<SfxCategory, SfxConfig> = {
  step: {
    files: [
      { key: "step-left", path: "audio/foot_left.mp3" },
      { key: "step-right", path: "audio/foot_right.mp3" },
    ],
    volume: 0.5,
    minIntervalMs: 160,
    selection: "cycle",
  },
  growl: {
    files: [
      { key: "growl-1", path: "audio/growl-1.mp3" },
      { key: "growl-2", path: "audio/growl-2.mp3" },
    ],
    volume: 0.4,
    minIntervalMs: 600,
    selection: "random",
  },
  scream: {
    files: [
      { key: "scream-1", path: "audio/Screech1.mp3" },
      { key: "scream-2", path: "audio/Screech2.mp3" },
    ],
    volume: 0.55,
    minIntervalMs: 800,
    selection: "random",
  },
  crawl_growl: {
    files: [
      { key: "crawl_growl-1", path: "audio/crawl_growl-1.mp3" },
      { key: "crawl_growl-2", path: "audio/crawl_growl-2.mp3" },
    ],
    volume: 0.4,
    minIntervalMs: 600,
    selection: "random",
  },
  crawl_scream: {
    files: [
      { key: "crawl_scream-1", path: "audio/crawl_scream-1.mp3" },
      { key: "crawl_scream-2", path: "audio/crawl_scream-2.mp3" },
    ],
    volume: 0.55,
    minIntervalMs: 800,
    selection: "random",
  },
  gong: {
    files: [{ key: "gong", path: "audio/gong.mp3" }],
    volume: 0.7,
    selection: "random",
  },
};

const FADE_OUT_MS = 60;

export class AudioManager {
  private scene: Phaser.Scene;
  private lastPlayed: Map<SfxCategory, number>;
  private warnedCategories: Set<SfxCategory>;
  private actorSounds: Map<Actor, Phaser.Sound.BaseSound>;
  private categorySounds: Map<SfxCategory, Phaser.Sound.BaseSound>;
  private cycleIndex: Map<SfxCategory, number>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.lastPlayed = new Map();
    this.warnedCategories = new Set();
    this.actorSounds = new Map();
    this.categorySounds = new Map();
    this.cycleIndex = new Map();
  }

  preloadAll() {
    for (const cfg of Object.values(SFX_CONFIG)) {
      for (const file of cfg.files) {
        if (!this.scene.cache.audio.exists(file.key)) {
          this.scene.load.audio(file.key, file.path);
        }
      }
    }
  }

  play(
    category: SfxCategory,
    options: { distance?: number; maxDistance?: number } = {}
  ) {
    const choice = this.pickAndCheck(category, options);
    if (!choice) return;
    this.scene.sound.play(choice.key, { volume: choice.volume });
    this.lastPlayed.set(category, this.scene.time.now);
  }

  playSelfTerminating(
    category: SfxCategory,
    options: { distance?: number; maxDistance?: number } = {}
  ) {
    const choice = this.pickAndCheck(category, options);
    if (!choice) return;

    this.fadeOutAndDestroy(this.categorySounds.get(category));

    const sound = this.scene.sound.add(choice.key, { volume: choice.volume });
    sound.play();

    sound.once(Phaser.Sound.Events.COMPLETE, () => {
      sound.destroy();
      if (this.categorySounds.get(category) === sound) {
        this.categorySounds.delete(category);
      }
    });

    this.categorySounds.set(category, sound);
    this.lastPlayed.set(category, this.scene.time.now);
  }

  playForActor(
    actor: Actor,
    category: SfxCategory,
    options: { distance?: number; maxDistance?: number } = {}
  ) {
    const choice = this.pickAndCheck(category, options);
    if (!choice) return;

    this.stopActorSound(actor);

    const sound = this.scene.sound.add(choice.key, { volume: choice.volume });
    sound.play();

    sound.once(Phaser.Sound.Events.COMPLETE, () => {
      sound.destroy();
      if (this.actorSounds.get(actor) === sound) {
        this.actorSounds.delete(actor);
      }
    });

    this.actorSounds.set(actor, sound);
    this.lastPlayed.set(category, this.scene.time.now);
  }

  stopActorSound(actor: Actor) {
    const sound = this.actorSounds.get(actor);
    if (!sound) return;
    sound.stop();
    sound.destroy();
    this.actorSounds.delete(actor);
  }

  stopAllActorSounds() {
    for (const sound of this.actorSounds.values()) {
      sound.stop();
      sound.destroy();
    }
    this.actorSounds.clear();
  }

  private fadeOutAndDestroy(sound: Phaser.Sound.BaseSound | undefined) {
    if (!sound) return;
    if (!sound.isPlaying) {
      sound.destroy();
      return;
    }
    try {
      (sound as Phaser.Sound.WebAudioSound).volume = 0;
    } catch {
      // ignore
    }
    sound.stop();
    sound.destroy();
  }

  private pickAndCheck(
    category: SfxCategory,
    options: { distance?: number; maxDistance?: number }
  ): { key: string; volume: number } | null {
    const cfg = SFX_CONFIG[category];

    const now = this.scene.time.now;
    const last = this.lastPlayed.get(category) ?? 0;
    if (cfg.minIntervalMs && now - last < cfg.minIntervalMs) return null;

    let volume = cfg.volume;
    if (options.distance !== undefined) {
      const maxDist = options.maxDistance ?? 8;
      if (options.distance >= maxDist) return null;
      const factor = 1 - options.distance / maxDist;
      volume *= factor;
    }
    if (volume <= 0.01) return null;

    const candidates = cfg.files.filter((f) =>
      this.scene.cache.audio.exists(f.key)
    );
    if (candidates.length === 0) {
      if (!this.warnedCategories.has(category)) {
        console.warn(`SFX manquants pour catégorie "${category}"`);
        this.warnedCategories.add(category);
      }
      return null;
    }

    let choice;
    if (cfg.selection === "cycle") {
      const idx = (this.cycleIndex.get(category) ?? 0) % candidates.length;
      choice = candidates[idx];
      this.cycleIndex.set(category, idx + 1);
    } else {
      choice = candidates[Math.floor(Math.random() * candidates.length)];
    }

    return { key: choice.key, volume };
  }
}