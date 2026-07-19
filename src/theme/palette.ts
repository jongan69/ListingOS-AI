export const darkPalette = {
  header: "#02060B",
  background: "#07111B",
  backgroundAlt: "#0C1826",
  card: "rgba(11, 23, 36, 0.82)",
  cardStrong: "rgba(15, 31, 46, 0.92)",
  cardMuted: "rgba(10, 19, 31, 0.74)",
  border: "rgba(140, 173, 201, 0.16)",
  borderStrong: "rgba(142, 206, 255, 0.28)",
  text: "#F4F7FB",
  textMuted: "#9DB0C3",
  textSoft: "#75879B",
  cyan: "#8ED0FF",
  cyanStrong: "#47B8FF",
  teal: "#66E1D1",
  gold: "#F9C772",
  rose: "#F39AB1",
  green: "#6BE3A5",
  red: "#FF8F8F",
  shadow: "rgba(0, 0, 0, 0.28)",
};

export const lightPalette: typeof darkPalette = {
  header: "#F4F8FC",
  background: "#EEF3F8",
  backgroundAlt: "#E4ECF4",
  card: "rgba(255, 255, 255, 0.82)",
  cardStrong: "rgba(255, 255, 255, 0.95)",
  cardMuted: "rgba(255, 255, 255, 0.6)",
  border: "rgba(20, 40, 60, 0.10)",
  borderStrong: "rgba(20, 100, 160, 0.22)",
  text: "#0B1520",
  textMuted: "#45566A",
  textSoft: "#6B7C90",
  cyan: "#1C8FE0",
  cyanStrong: "#0B6FC2",
  teal: "#0EA894",
  gold: "#C98A1E",
  rose: "#D45577",
  green: "#1F9A63",
  red: "#D6432F",
  shadow: "rgba(15, 35, 55, 0.12)",
};

export const darkGradients = {
  hero: ["#1C3F66", "#0E7C86", "#0A1724"],
  card: ["rgba(112, 195, 255, 0.16)", "rgba(102, 225, 209, 0.04)"],
  accent: ["rgba(71, 184, 255, 0.28)", "rgba(102, 225, 209, 0.08)"],
  warm: ["rgba(249, 199, 114, 0.16)", "rgba(243, 154, 177, 0.06)"],
};

export const lightGradients: typeof darkGradients = {
  hero: ["#BFE3FF", "#9FE8DD", "#EAF3FB"],
  card: ["rgba(28, 143, 224, 0.10)", "rgba(14, 168, 148, 0.03)"],
  accent: ["rgba(11, 111, 194, 0.16)", "rgba(14, 168, 148, 0.05)"],
  warm: ["rgba(201, 138, 30, 0.12)", "rgba(212, 85, 119, 0.05)"],
};

export type Palette = typeof darkPalette;
export type Gradients = typeof darkGradients;
