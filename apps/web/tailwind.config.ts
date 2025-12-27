import type { Config } from "tailwindcss";

/**
 * HANDCRAFT DESIGN SYSTEM - TAILWIND CONFIGURATION
 * =================================================
 * This configuration extends Tailwind with our standardized design tokens.
 *
 * TYPOGRAPHY SCALE (use these, not arbitrary values):
 * - text-2xs  (9px)  - Micro labels, badges
 * - text-xs   (10px) - Labels, captions, uppercase text
 * - text-sm   (11px) - Secondary text, descriptions, tabs
 * - text-base (13px) - Body text, inputs, buttons
 * - text-lg   (15px) - Page titles, section headers
 * - text-xl   (18px) - Large numbers, feature headers
 * - text-2xl  (24px) - Hero text (use sparingly)
 *
 * BORDER RADIUS (use these, not arbitrary values):
 * - rounded-sm  (4px)  - Small elements, badges
 * - rounded-md  (6px)  - Buttons, inputs, tabs
 * - rounded-lg  (8px)  - Cards, modals, containers
 * - rounded-xl  (12px) - Large cards (rarely used)
 * - rounded-full       - Avatars, pills
 *
 * ICON SIZES (use these classes):
 * - icon-xs  (12px) - Inline with small text
 * - icon-sm  (14px) - Inline with body text
 * - icon-md  (16px) - Buttons, inputs
 * - icon-lg  (20px) - Section icons, nav
 * - icon-xl  (24px) - Feature icons
 * - icon-2xl (32px) - Empty states, hero
 */

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // ========================================
      // TYPOGRAPHY
      // ========================================
      fontSize: {
        "2xs": ["9px", { lineHeight: "1.2" }],
        "xs": ["10px", { lineHeight: "1.3" }],
        "sm": ["11px", { lineHeight: "1.4" }],
        "base": ["13px", { lineHeight: "1.5" }],
        "lg": ["15px", { lineHeight: "1.5" }],
        "xl": ["18px", { lineHeight: "1.4" }],
        "2xl": ["24px", { lineHeight: "1.3" }],
        "3xl": ["30px", { lineHeight: "1.2" }],
      },

      // ========================================
      // BORDER RADIUS
      // ========================================
      borderRadius: {
        "sm": "4px",
        "md": "6px",
        "lg": "8px",
        "xl": "12px",
        "2xl": "16px",
      },

      // ========================================
      // SPACING (extends default)
      // ========================================
      spacing: {
        "header": "56px",
        "sidebar": "256px",
        "tab-bar": "44px",
      },

      // ========================================
      // CONTAINER SIZES
      // ========================================
      maxWidth: {
        "modal-sm": "384px",   // max-w-sm equivalent
        "modal-md": "512px",   // max-w-lg equivalent
        "modal-lg": "672px",   // max-w-2xl equivalent
        "page": "1024px",      // Standard page width
      },

      // ========================================
      // COLORS
      // ========================================
      colors: {
        // Surface colors
        surface: {
          base: "#000000",
          elevated: "rgba(255, 255, 255, 0.02)",
          hover: "rgba(255, 255, 255, 0.04)",
          active: "rgba(255, 255, 255, 0.06)",
        },
        // Border colors
        border: {
          subtle: "rgba(255, 255, 255, 0.06)",
          default: "rgba(255, 255, 255, 0.08)",
          strong: "rgba(255, 255, 255, 0.12)",
        },
        // Text colors
        content: {
          primary: "rgba(255, 255, 255, 0.9)",
          secondary: "rgba(255, 255, 255, 0.6)",
          tertiary: "rgba(255, 255, 255, 0.4)",
          disabled: "rgba(255, 255, 255, 0.2)",
        },
        // Brand colors (extended palettes)
        primary: {
          50: "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7c3aed",
          800: "#6b21a8",
          900: "#581c87",
          950: "#3b0764",
        },
        secondary: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
          950: "#083344",
        },
      },

      // ========================================
      // ANIMATIONS
      // ========================================
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "fade-out": "fadeOut 200ms ease-in",
        "slide-up": "slideUp 200ms ease-out",
        "slide-down": "slideDown 200ms ease-out",
        "scale-in": "scaleIn 200ms ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },

      // ========================================
      // TRANSITIONS
      // ========================================
      transitionDuration: {
        "fast": "150ms",
        "normal": "200ms",
        "slow": "300ms",
      },

      // ========================================
      // BACKDROP BLUR
      // ========================================
      backdropBlur: {
        "xs": "4px",
        "header": "16px",
        "modal": "12px",
      },

      // ========================================
      // BOX SHADOW
      // ========================================
      boxShadow: {
        "modal": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        "dropdown": "0 10px 40px rgba(0, 0, 0, 0.5)",
        "card": "0 4px 16px rgba(0, 0, 0, 0.3)",
      },

      // ========================================
      // FONT FAMILY
      // ========================================
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
