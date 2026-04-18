import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: "class",
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", lg: "2rem" },
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        // Obsidian surface hierarchy
        obsidian: {
          900: "#07070a", // deepest void
          800: "#0b0c12", // app background
          700: "#111218", // panel base
          600: "#16181f", // raised panel
          500: "#1c1f27", // border-adjacent surface
          400: "#242833", // hover surface
          300: "#323745", // muted surface
        },
        ash: {
          500: "#5a5f6d",
          400: "#7a8090",
          300: "#9aa0b0",
          200: "#c4c8d4",
          100: "#e7e9f0",
        },
        parchment: "#d9cdb3",
        steel: {
          500: "#4a5161",
          400: "#6b7281",
          300: "#8b92a3",
        },
        // Accents
        ember: {
          500: "#ff6a1f", // molten
          400: "#ff8a4a",
          600: "#d14f0f",
          glow: "#ffb07a",
        },
        rune: {
          500: "#7b4dff", // violet rune
          400: "#9b75ff",
          600: "#5b31d6",
          glow: "#b49dff",
        },
        spectral: {
          500: "#3ee0ff", // moonlit cyan
          400: "#6be9ff",
          600: "#18b6d8",
          glow: "#a8f1ff",
        },
        crimson: {
          500: "#e03a4d", // champion emphasis
          400: "#ef5b6c",
          600: "#b72636",
        },
        gold: {
          500: "#e8b84a", // trophies / mythic
          400: "#f2cd74",
          600: "#b88a25",
        },
        // Semantic
        success: "#4ade80",
        warning: "#fbbf24",
        danger: "#ef4444",
        info: "#3ee0ff",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-monospace", "monospace"], // pixel/retro
        heading: ["var(--font-heading)", "system-ui", "sans-serif"], // fantasy-tech
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["3.5rem", { lineHeight: "1.05", letterSpacing: "0.02em" }],
        "display-lg": ["2.5rem", { lineHeight: "1.1", letterSpacing: "0.02em" }],
        "display-md": ["1.75rem", { lineHeight: "1.15", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        // Sharp, slight bevel — not soft
        pixel: "2px",
        slab: "4px",
        panel: "6px",
      },
      boxShadow: {
        "glow-ember": "0 0 0 1px rgba(255,106,31,0.35), 0 0 24px -4px rgba(255,106,31,0.45)",
        "glow-rune": "0 0 0 1px rgba(123,77,255,0.4), 0 0 24px -4px rgba(123,77,255,0.5)",
        "glow-spectral": "0 0 0 1px rgba(62,224,255,0.4), 0 0 24px -4px rgba(62,224,255,0.45)",
        "glow-gold": "0 0 0 1px rgba(232,184,74,0.45), 0 0 28px -4px rgba(232,184,74,0.55)",
        slab: "inset 0 1px 0 0 rgba(255,255,255,0.04), 0 2px 0 0 rgba(0,0,0,0.6), 0 8px 24px -8px rgba(0,0,0,0.7)",
        inset: "inset 0 2px 6px 0 rgba(0,0,0,0.55)",
      },
      backgroundImage: {
        "obsidian-grain":
          "radial-gradient(circle at 30% 20%, rgba(123,77,255,0.06), transparent 50%), radial-gradient(circle at 80% 70%, rgba(62,224,255,0.05), transparent 55%), linear-gradient(180deg, #0b0c12 0%, #07070a 100%)",
        "ember-crack":
          "linear-gradient(90deg, transparent 0%, rgba(255,106,31,0.5) 50%, transparent 100%)",
        "rune-grid":
          "linear-gradient(rgba(123,77,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(123,77,255,0.05) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "24px 24px",
      },
      animation: {
        "pulse-rune": "pulseRune 2.4s ease-in-out infinite",
        "flicker-ember": "flickerEmber 3s ease-in-out infinite",
        "count-up": "countUp 600ms ease-out both",
        "slide-up": "slideUp 250ms ease-out both",
      },
      keyframes: {
        pulseRune: {
          "0%, 100%": { opacity: "0.6", filter: "brightness(1)" },
          "50%": { opacity: "1", filter: "brightness(1.35)" },
        },
        flickerEmber: {
          "0%, 100%": { opacity: "0.85" },
          "47%": { opacity: "0.95" },
          "50%": { opacity: "0.6" },
          "53%": { opacity: "0.95" },
        },
        countUp: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
