/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        accent: "var(--accent)",
        "on-accent": "var(--on-accent)",
        wash: "var(--wash)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["Public Sans", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Bricolage Grotesque", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
