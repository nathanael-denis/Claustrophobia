// src/systems/Lantern.ts
// La lanterne du joueur : batterie, on/off, instabilité.

export type LanternState =
  | "off"
  | "stable"
  | "unstable"
  | "flickering"
  | "dead";

export const UNSTABLE_THRESHOLD = 20;
export const FLICKER_CHANCE = 0.33;
export const BATTERY_DRAIN_PER_MOVE = 1;

export class Lantern {
  public battery: number;
  public on: boolean;
  public flickeringThisTurn: boolean;

  constructor() {
    this.battery = 100;
    this.on = true;
    this.flickeringThisTurn = false;
  }

  getState(): LanternState {
    if (this.battery <= 0) return "dead";
    if (!this.on) return "off";
    if (this.flickeringThisTurn) return "flickering";
    if (this.battery <= UNSTABLE_THRESHOLD) return "unstable";
    return "stable";
  }

  isEmittingLight(): boolean {
    const s = this.getState();
    return s === "stable" || s === "unstable";
  }

  toggle(): boolean {
    if (this.battery <= 0) {
      this.on = false;
      return false;
    }
    this.on = !this.on;
    return this.on;
  }

  tick(moved: boolean): { wentDark: boolean; startedFlicker: boolean } {
    this.flickeringThisTurn = false;
    let wentDark = false;
    let startedFlicker = false;

    if (!this.on || this.battery <= 0) {
      return { wentDark, startedFlicker };
    }

    if (moved) {
      this.battery = Math.max(0, this.battery - BATTERY_DRAIN_PER_MOVE);
    }

    if (this.battery <= 0) {
      this.on = false;
      wentDark = true;
      return { wentDark, startedFlicker };
    }

    if (this.battery <= UNSTABLE_THRESHOLD && Math.random() < FLICKER_CHANCE) {
      this.flickeringThisTurn = true;
      startedFlicker = true;
    }

    return { wentDark, startedFlicker };
  }
}