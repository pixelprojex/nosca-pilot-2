/** Nosca's own tokens, carried over from the prototype rather than
 *  Tailwind's defaults — the warm sandstone canvas, the semantic
 *  red/amber/green, and the radius scale used throughout. */
import plugin from "tailwindcss/plugin";

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
  /* ONE PRESS (18 November): \`active:\` is the app's own press — the
     data-down the one listener in Nosca.jsx sets once a finger has stayed
     put PRESS_DELAY, never the browser's :active, which iOS raises at the
     first touch of a scroll and so flickered every row under the thumb */
  plugins: [plugin(({ addVariant }) => { addVariant("active", "&[data-down]"); })],
};
