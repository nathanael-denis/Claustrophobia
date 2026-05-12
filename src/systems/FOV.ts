// src/systems/FOV.ts
// Calcule le champ de vision du joueur.
//
// Lampe allumée  : cône directionnel de 90° (6 cases) + halo avant rapproché.
// Lampe éteinte  : halo avant uniquement (4 cases par défaut, 5 si Nyctalope).
//
// Le halo lampe-éteinte est composé de deux éléments :
//  - 3 cases adjacentes en cône avant (devant + 2 diagonales avant)
//  - 1 case "rayon" en ligne droite à distance 2 (perception en pénombre)
//
// Nyctalope étend le "rayon" d'une case en ligne droite (jusqu'à distance 3).

import * as ROT from "rot-js";
import type { Dungeon } from "../dungeon/Dungeon";
import type { Direction } from "./Direction";

const LANTERN_RADIUS = 6;
const LANTERN_CONE_ANGLE = 90;

// Portée du "rayon" en ligne droite devant (cases visibles en pénombre).
// Le rayon de base est 2 (= 1 case adjacente + 1 case un peu plus loin).
// Avec Nyctalope, ce rayon augmente de 1.
const FORWARD_RAY_BASE = 2;

export class FOV {
  private dungeon: Dungeon;
  private visible: boolean[][];
  private fovCalculator: InstanceType<typeof ROT.FOV.PreciseShadowcasting>;

  constructor(dungeon: Dungeon) {
    this.dungeon = dungeon;
    this.visible = [];
    for (let y = 0; y < dungeon.tiles.length; y++) {
      this.visible[y] = new Array(dungeon.tiles[0].length).fill(false);
    }
    this.fovCalculator = new ROT.FOV.PreciseShadowcasting((x, y) =>
      !dungeon.blocksSight(x, y)
    );
  }

  isVisible(x: number, y: number): boolean {
    if (y < 0 || y >= this.visible.length) return false;
    if (x < 0 || x >= this.visible[0].length) return false;
    return this.visible[y][x];
  }

  private clear() {
    for (let y = 0; y < this.visible.length; y++) {
      for (let x = 0; x < this.visible[0].length; x++) {
        this.visible[y][x] = false;
      }
    }
  }

  private markVisible(x: number, y: number) {
    if (y < 0 || y >= this.visible.length) return;
    if (x < 0 || x >= this.visible[0].length) return;
    this.visible[y][x] = true;
    this.dungeon.explored[y][x] = true;
  }

  computeWithLantern(px: number, py: number, direction: Direction, bonusForwardRay: number = 0) {
    this.clear();
    this.addCone(px, py, direction);
    this.addForwardHalo(px, py, direction, bonusForwardRay);
  }

  computeHaloOnly(px: number, py: number, direction: Direction, bonusForwardRay: number = 0) {
    this.clear();
    this.addForwardHalo(px, py, direction, bonusForwardRay);
  }

  // Halo lampe-éteinte : cône adjacent avant + rayon en ligne droite.
  //
  // Le cône adjacent (3 cases) couvre devant + diagonales avant.
  // Le rayon en ligne droite (2 cases par défaut, 3 avec Nyctalope) vise
  // pile en face : tu perçois quelque chose qui bouge à distance, mais pas
  // ce qui est sur les côtés.
  //
  // Bloquage par murs : géré automatiquement par le fovCalculator.
  private addForwardHalo(px: number, py: number, direction: Direction, bonusForwardRay: number) {
    // Le joueur voit toujours sa propre case
    this.markVisible(px, py);

    // 1. Les 3 cases adjacentes en cône avant
    const adjacentCone = this.getAdjacentForwardCells(direction);
    const rayDistance = FORWARD_RAY_BASE + bonusForwardRay;
    const forwardRay = this.getForwardRayCells(direction, rayDistance);

    // On rassemble toutes les cases candidates dans un Set pour lookup rapide
    const allOffsets = [...adjacentCone, ...forwardRay];
    const candidateSet = new Set(allOffsets.map(([dx, dy]) => `${dx},${dy}`));

    // Calcul de la distance maximale pour le compute FOV (rayon + 1 marge)
    const maxRadius = Math.max(1, rayDistance);

    // On utilise le fovCalculator pour vérifier les blocages par murs.
    // Une case n'est marquée visible que si elle est candidate ET pas occultée.
    this.fovCalculator.compute(px, py, maxRadius, (x, y) => {
      const dx = x - px;
      const dy = y - py;
      const key = `${dx},${dy}`;
      if (candidateSet.has(key)) {
        this.markVisible(x, y);
      }
    });
  }

  // Renvoie les 3 cases adjacentes en cône avant pour la direction donnée.
  // Pour "right" : (1,-1), (1,0), (1,1)
  // Pour "left"  : (-1,-1), (-1,0), (-1,1)
  // Pour "up"    : (-1,-1), (0,-1), (1,-1)
  // Pour "down"  : (-1,1), (0,1), (1,1)
  private getAdjacentForwardCells(direction: Direction): [number, number][] {
    switch (direction) {
      case "right": return [[1, -1], [1, 0], [1, 1]];
      case "left":  return [[-1, -1], [-1, 0], [-1, 1]];
      case "up":    return [[-1, -1], [0, -1], [1, -1]];
      case "down":  return [[-1, 1], [0, 1], [1, 1]];
    }
  }

  // Renvoie les cases en ligne droite devant, à partir de la distance 2.
  // La case à distance 1 est déjà dans le cône adjacent.
  // Pour "right" avec rayDistance=2 : [(2, 0)]
  // Pour "right" avec rayDistance=3 : [(2, 0), (3, 0)]
  private getForwardRayCells(direction: Direction, rayDistance: number): [number, number][] {
    const cells: [number, number][] = [];
    for (let dist = 2; dist <= rayDistance; dist++) {
      switch (direction) {
        case "right": cells.push([dist, 0]); break;
        case "left":  cells.push([-dist, 0]); break;
        case "up":    cells.push([0, -dist]); break;
        case "down":  cells.push([0, dist]); break;
      }
    }
    return cells;
  }

  private addCone(px: number, py: number, direction: Direction) {
    const halfAngle = LANTERN_CONE_ANGLE / 2;
    const dirAngle = this.directionToAngle(direction);

    this.fovCalculator.compute(px, py, LANTERN_RADIUS, (x, y) => {
      if (x === px && y === py) {
        this.markVisible(x, y);
        return;
      }
      const dx = x - px;
      const dy = y - py;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const diff = this.angleDiff(angle, dirAngle);
      if (Math.abs(diff) <= halfAngle) {
        this.markVisible(x, y);
      }
    });
  }

  private directionToAngle(direction: Direction): number {
    switch (direction) {
      case "right": return 0;
      case "down": return 90;
      case "left": return 180;
      case "up": return -90;
    }
  }

  private angleDiff(a: number, b: number): number {
    let diff = a - b;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  }
}