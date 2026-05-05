// src/config.ts
// Constantes globales du jeu. Centraliser ici évite les "nombres magiques" éparpillés.

export const TILE_SIZE = 24; // taille d'une case en pixels à l'écran
export const MAP_WIDTH = 40; // largeur du donjon en cases
export const MAP_HEIGHT = 25; // hauteur du donjon en cases

// Codes de tuiles. On reste sur des entiers pour la performance.
export const TILE_FLOOR = 0;
export const TILE_WALL = 1;

export type TileType = typeof TILE_FLOOR | typeof TILE_WALL;
