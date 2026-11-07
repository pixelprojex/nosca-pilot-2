import react from "eslint-plugin-react";
import globals from "globals";

/* npm run check: the names-and-tags checks the build cannot make. */
const CATCHES = {
  "no-undef": "error",
  "no-redeclare": "error",
  "no-dupe-keys": "error",
  "no-const-assign": "error",
  "no-dupe-args": "error",
  "no-unreachable": "error",
  "no-use-before-define": ["error", { functions: false, classes: false, variables: false }],
};

export default [
  { ignores: ["dist/**", "node_modules/**", "gallery.html"] },
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, __BUILD_TIME__: "readonly" },
    },
    settings: { react: { version: "18.3" } },
    rules: {
      ...CATCHES,
      "react/jsx-no-undef": "error",
      "react/jsx-uses-vars": "error",
      "react/jsx-no-duplicate-props": "error",
    },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node } },
    rules: CATCHES,
  },
];
