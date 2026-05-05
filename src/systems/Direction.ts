// src/systems/Direction.ts
// Une direction cardinale + utilitaires.

export type Direction = "up" | "down" | "left" | "right";

export const DIRECTION_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const DIRECTION_GLYPHS: Record<Direction, string> = {
  up: "^",
  down: "v",
  left: "<",
  right: ">",
};

// Convertit un (dx, dy) en Direction. Renvoie null si pas une direction cardinale.
export function deltaToDirection(dx: number, dy: number): Direction | null {
  if (dx === 0 && dy === -1) return "up";
  if (dx === 0 && dy === 1) return "down";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 1 && dy === 0) return "right";
  return null;
}