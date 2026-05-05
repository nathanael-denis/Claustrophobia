// src/dungeon/Dungeon.ts
import * as ROT from "rot-js";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_FLOOR,
  TILE_WALL,
} from "../config";
import type { TileType } from "../config";

export class Dungeon {
  public tiles: TileType[][];
  public rooms: any[] = [];
  // Cases déjà découvertes par le joueur (mémoire persistante).
  // explored[y][x] = true si on l'a déjà vue au moins une fois.
  public explored: boolean[][];

  constructor() {
    this.tiles = Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, () => TILE_WALL as TileType)
    );
    this.explored = Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, () => false)
    );

    const digger = new ROT.Map.Digger(MAP_WIDTH, MAP_HEIGHT);
    digger.create((x, y, value) => {
      this.tiles[y][x] = value === 0 ? TILE_FLOOR : TILE_WALL;
    });

    this.rooms = digger.getRooms();
  }

  isWalkable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return false;
    return this.tiles[y][x] === TILE_FLOOR;
  }

  // Une case bloque-t-elle la lumière ? Pour la FOV.
  // Pour l'instant : seuls les murs bloquent. Plus tard : portes fermées, etc.
  blocksSight(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return true;
    return this.tiles[y][x] === TILE_WALL;
  }

  getSpawnPosition(): { x: number; y: number } {
    const room = this.rooms[0];
    const x = Math.floor((room.getLeft() + room.getRight()) / 2);
    const y = Math.floor((room.getTop() + room.getBottom()) / 2);
    return { x, y };
  }
}