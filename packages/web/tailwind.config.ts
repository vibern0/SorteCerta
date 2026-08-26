import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#E8E3E1",
        surface: "#F4F1F0",
        surface2: "#EEE9E7",
        border: "#D8D0CE",
        text: "#2B2D32",
        muted: "#67666D",
        brand: "#34363C",
        brandHover: "#202227",
        success: "#4A7A6D",
        danger: "#A85262",
        warning: "#9B693E",
      },
      fontFamily: {
        sans: ["var(--font-interphases-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-ramillas)", "Georgia", "serif"],
        mono: ["var(--font-interphases-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.4s ease-out",
        "toast-in": "toastIn 0.48s cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        toastIn: {
          "0%": { opacity: "0", transform: "translateY(-18px) scale(0.96)" },
          "60%": { opacity: "1", transform: "translateY(2px) scale(1.01)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
