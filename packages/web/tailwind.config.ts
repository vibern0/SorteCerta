import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#2548F4",
        surface: "#FFF9EF",
        surface2: "#D5C5FF",
        border: "#D5C5FF",
        text: "#17213B",
        muted: "#5C6170",
        brand: "#2548F4",
        brandHover: "#1935C7",
        citron: "#E4F66A",
        success: "#236B4F",
        danger: "#B84754",
        warning: "#9A6518",
      },
      fontFamily: {
        sans: ["Avenir Next", "ui-rounded", "system-ui", "sans-serif"],
        display: ["ui-rounded", "Arial Rounded MT Bold", "Avenir Next", "system-ui", "sans-serif"],
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
