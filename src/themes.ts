import type { ThemeName } from "./types";

export interface ThemeOption {
  id: ThemeName;
  swatches: string[];
  seed: string;
}

export const themeOptions: ThemeOption[] = [
  {
    id: "ramune",
    seed: "#35a7d8",
    swatches: ["#35a7d8", "#ffc4d6", "#ffe27a", "#f7fcff"]
  },
  {
    id: "seaside",
    seed: "#2c9c87",
    swatches: ["#42bca3", "#fff3d8", "#ff9f80", "#0d4c55"]
  },
  {
    id: "natsumatsuri",
    seed: "#ffb64d",
    swatches: ["#23315f", "#ff6f61", "#ffb64d", "#9c7ad6"]
  },
  {
    id: "google-night",
    seed: "#8ab4f8",
    swatches: ["#8ab4f8", "#202124", "#303134", "#e8eaed"]
  }
];
