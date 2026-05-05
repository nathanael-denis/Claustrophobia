// src/systems/Pathfinding.ts
// Wrapper autour de ROT.Path.AStar pour calculer un chemin entre deux points.
// On garde ça séparé pour pouvoir changer d'algo (Dijkstra, etc.) facilement.

import * as ROT from "rot-js";

export interface PathStep {
  x: number;
  y: number;
}

// Calcule le chemin de (fromX, fromY) à (toX, toY).
// `passable(x, y)` doit renvoyer true si la case est traversable.
// Renvoie le chemin SANS la case de départ (donc le premier élément
// est la prochaine case à occuper).
// Renvoie [] si aucun chemin n'existe.
export function findPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  passable: (x: number, y: number) => boolean
): PathStep[] {
  // ROT.Path.AStar trouve un chemin de toX,toY vers fromX,fromY (oui, à l'envers)
  // et appelle le callback pour chaque case en partant de la destination
  // jusqu'à la source.
  const astar = new ROT.Path.AStar(toX, toY, passable, { topology: 4 });
  // topology: 4 = mouvements cardinaux (N/S/E/O), pas de diagonales.
  // topology: 8 = diagonales autorisées. À toi de voir, mais 4 est plus
  // "Pokémon DM" et plus simple à équilibrer pour le combat.

  const path: PathStep[] = [];
  astar.compute(fromX, fromY, (x, y) => {
    path.push({ x, y });
  });

  // Le premier élément est la position de départ. On l'enlève.
  if (path.length > 0) path.shift();
  return path;
}