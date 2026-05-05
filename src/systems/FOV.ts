// src/systems/FOV.ts
import * as ROT from "rot-js";
import { MAP_WIDTH, MAP_HEIGHT } from "../config";
import type { Dungeon } from "../dungeon/Dungeon";
import type { Direction } from "./Direction";

export const LANTERN_RADIUS = 8;
export const HALO_RADIUS = 1;

export class FOV {
  public visible: boolean[][];
  private dungeon: Dungeon;
  private fovCalculator: InstanceType<typeof ROT.FOV.PreciseShadowcasting>;

  constructor(dungeon: Dungeon) {
    this.dungeon = dungeon;
    this.visible = this.makeEmptyGrid();
    this.fovCalculator = new ROT.FOV.PreciseShadowcasting(
      (x, y) => !this.dungeon.blocksSight(x, y)
    );
  }

  private makeEmptyGrid(): boolean[][] {
    return Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, () => false)
    );
  }

  computeWithLantern(originX: number, originY: number, direction: Direction) {
    this.visible = this.makeEmptyGrid();

    this.fovCalculator.compute(originX, originY, LANTERN_RADIUS, (x, y) => {
      if (!this.inBounds(x, y)) return;
      if (this.isInCone(originX, originY, x, y, direction)) {
        this.visible[y][x] = true;
        this.dungeon.explored[y][x] = true;
      }
    });

    this.addHalo(originX, originY);
  }

  computeHaloOnly(originX: number, originY: number) {
    this.visible = this.makeEmptyGrid();
    this.addHalo(originX, originY);
  }

  private addHalo(originX: number, originY: number) {
    this.fovCalculator.compute(originX, originY, HALO_RADIUS, (x, y) => {
      if (!this.inBounds(x, y)) return;
      this.visible[y][x] = true;
      this.dungeon.explored[y][x] = true;
    });
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT;
  }

  private isInCone(
    ox: number, oy: number,
    tx: number, ty: number,
    direction: Direction
  ): boolean {
    if (ox === tx && oy === ty) return true;

    const dx = tx - ox;
    const dy = ty - oy;

    switch (direction) {
      case "right": return dx > 0 && dx >= Math.abs(dy);
      case "left":  return dx < 0 && -dx >= Math.abs(dy);
      case "down":  return dy > 0 && dy >= Math.abs(dx);
      case "up":    return dy < 0 && -dy >= Math.abs(dx);
    }
  }

  isVisible(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return this.visible[y][x];
  }
}