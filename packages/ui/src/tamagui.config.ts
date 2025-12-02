import { createTamagui } from "tamagui";
import { createInterFont } from "@tamagui/font-inter";
import { shorthands } from "@tamagui/shorthands";
import { themes, tokens } from "@tamagui/themes";
import { createAnimations } from "@tamagui/animations-css";

const animations = createAnimations({
  fast: "ease-in 150ms",
  medium: "ease-in 300ms",
  slow: "ease-in 450ms",
  bouncy: "cubic-bezier(0.175, 0.885, 0.32, 1.275) 300ms",
  lazy: "ease-in-out 600ms",
});

const headingFont = createInterFont({
  size: {
    6: 15,
    7: 18,
    8: 21,
    9: 24,
    10: 28,
    11: 32,
    12: 40,
    13: 48,
    14: 56,
    15: 72,
    16: 96,
  },
  weight: {
    6: "600",
    7: "700",
    8: "700",
    9: "700",
    10: "700",
  },
  letterSpacing: {
    5: 0,
    6: -0.5,
    7: -0.5,
    8: -1,
    9: -1,
    10: -1,
    11: -1,
    12: -1.5,
    13: -2,
    14: -2,
    15: -3,
  },
  face: {
    700: { normal: "InterBold" },
    600: { normal: "InterSemiBold" },
  },
});

const bodyFont = createInterFont(
  {
    face: {
      400: { normal: "Inter" },
      500: { normal: "InterMedium" },
    },
  },
  {
    sizeSize: (size) => Math.round(size * 1.1),
    sizeLineHeight: (size) => Math.round(size * 1.5),
  }
);

// Custom tokens for Handcraft brand
const customTokens = {
  ...tokens,
  color: {
    ...tokens.color,
    // Primary brand colors
    primary50: "#f0f9ff",
    primary100: "#e0f2fe",
    primary200: "#bae6fd",
    primary300: "#7dd3fc",
    primary400: "#38bdf8",
    primary500: "#0ea5e9",
    primary600: "#0284c7",
    primary700: "#0369a1",
    primary800: "#075985",
    primary900: "#0c4a6e",
    // Secondary/accent colors
    secondary50: "#faf5ff",
    secondary100: "#f3e8ff",
    secondary200: "#e9d5ff",
    secondary300: "#d8b4fe",
    secondary400: "#c084fc",
    secondary500: "#a855f7",
    secondary600: "#9333ea",
    secondary700: "#7c3aed",
    secondary800: "#6b21a8",
    secondary900: "#581c87",
    // Success
    success: "#22c55e",
    // Error
    error: "#ef4444",
    // Warning
    warning: "#f59e0b",
  },
};

export const config = createTamagui({
  animations,
  defaultTheme: "dark",
  shouldAddPrefersColorThemes: true,
  themeClassNameOnRoot: true,
  shorthands,
  fonts: {
    heading: headingFont,
    body: bodyFont,
  },
  themes,
  tokens: customTokens,
  media: {
    xs: { maxWidth: 660 },
    sm: { maxWidth: 800 },
    md: { maxWidth: 1020 },
    lg: { maxWidth: 1280 },
    xl: { maxWidth: 1420 },
    xxl: { maxWidth: 1600 },
    gtXs: { minWidth: 660 + 1 },
    gtSm: { minWidth: 800 + 1 },
    gtMd: { minWidth: 1020 + 1 },
    gtLg: { minWidth: 1280 + 1 },
    short: { maxHeight: 820 },
    tall: { minHeight: 820 },
    hoverNone: { hover: "none" },
    pointerCoarse: { pointer: "coarse" },
  },
});

export default config;

// For TypeScript
export type AppConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}
