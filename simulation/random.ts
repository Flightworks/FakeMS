export interface SeededRandom {
  next(): number;
}

const UINT32_MAX = 0x1_0000_0000;

export const createSeededRandom = (seed: number): SeededRandom => {
  let state = (Math.trunc(seed) >>> 0) || 1;

  return {
    next: () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / UINT32_MAX;
    },
  };
};
