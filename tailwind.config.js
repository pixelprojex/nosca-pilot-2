/** Nosca's own tokens, carried over from the prototype rather than
 *  Tailwind's defaults — the warm sandstone canvas, the semantic
 *  red/amber/green, and the radius scale used throughout. */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        page: "#FAF7F0",
        surface: "#FFFDF8",
        ink: "#1A1815",
        sub: "#5A5650",
        faint: "#A39E93",
        hair: "#EDEAE1",
        wash: "#F1ECDF",
        danger: "#C4342A",
        caution: "#D08A1E",
        steady: "#2E7D4B",
      },
      borderRadius: {
        field: "6px",
        control: "9px",
        surface: "14px",
        sheet: "22px",
      },
      fontFamily: {
        display: ["'Cabinet Grotesk'", "ui-sans-serif", "system-ui"],
        ui: ["'Switzer'", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};
