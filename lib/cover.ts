/** Deterministic "vault label" cover art. Never shows scraped YouTube thumbnails. */

export interface CoverPalette {
  from: string;
  to: string;
  ink: string;
}

export const VAULT_PALETTES: CoverPalette[] = [
  { from: "#3b2f74", to: "#120c2a", ink: "#efe9ff" },
  { from: "#7a2740", to: "#1c0710", ink: "#ffeaf0" },
  { from: "#0f4c5c", to: "#04161b", ink: "#dff6fb" },
  { from: "#5a2d1b", to: "#170903", ink: "#ffe3d4" },
  { from: "#37401e", to: "#0c0f04", ink: "#eef5d8" },
  { from: "#4a2d64", to: "#12061c", ink: "#f5e6ff" },
  { from: "#1b4d3e", to: "#04140f", ink: "#d9f5ea" },
  { from: "#6b4f18", to: "#1a1202", ink: "#fff0c4" },
  { from: "#14213d", to: "#03060f", ink: "#dbe6ff" },
  { from: "#6d1f2c", to: "#170407", ink: "#ffe4e8" },
];

export function coverHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function paletteFor(input: string): CoverPalette {
  return VAULT_PALETTES[coverHash(input) % VAULT_PALETTES.length]!;
}

export function coverStyle(input: string): { background: string; color: string } {
  const { from, to, ink } = paletteFor(input);
  return {
    background: `linear-gradient(140deg, ${from} 0%, ${to} 100%)`,
    color: ink,
  };
}