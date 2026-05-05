// src/main.ts
import * as Phaser from "phaser";
import { SplashScene } from "./scenes/SplashScene";
import { MenuScene } from "./scenes/MenuScene";
import { BaseScene } from "./scenes/BaseScene";
import { BuildingScene } from "./scenes/BuildingScene";
import { GameScene } from "./scenes/GameScene";
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from "./config";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: MAP_WIDTH * TILE_SIZE,
  height: MAP_HEIGHT * TILE_SIZE,
  backgroundColor: "#0a0a0a",
  pixelArt: true,
  scene: [SplashScene, MenuScene, BaseScene, BuildingScene, GameScene],
};

new Phaser.Game(config);