import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg)",
        surface: "var(--surface)",
        border: "var(--border)",
        foreground: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
      },
      fontFamily: {
        sans: ["DM Sans", "Inter", "sans-serif"],
        display: ["Manrope", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
