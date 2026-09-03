import react from "eslint-plugin-react";
import globals from "globals";

/* STATIC CHECKS — `npm run check`
 *
 * The build (esbuild) only proves the files parse. It does not notice a
 * name that is never declared, a JSX tag that resolves to nothing, or
 * two attributes with the same name — all of which build clean and
 * then crash or misbehave in the browser. A sign-in that took the whole
 * app down with "loadError is not defined" was exactly that class of
 * bug. These rules catch it before a deploy does. Nothing here is a
 * style rule.
 */
export default [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: "18.3" } },
    rules: {
      "no-undef": "error",                       // a name that is never declared
      "react/jsx-no-undef": "error",             // a component tag that resolves to nothing
      "react/jsx-uses-vars": "error",
      "no-redeclare": "error",                   // two top-level declarations with one name
      "no-dupe-keys": "error",
      "react/jsx-no-duplicate-props": "error",   // the second silently wins over the first
      "no-const-assign": "error",
      "no-dupe-args": "error",
      "no-unreachable": "error",
      "no-use-before-define": ["error", { functions: false, classes: false, variables: false }],
    },
  },
];
