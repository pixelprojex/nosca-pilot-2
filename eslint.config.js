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
const CATCHES = {
  "no-undef": "error",                       // a name that is never declared
  "no-redeclare": "error",                   // two top-level declarations with one name
  "no-dupe-keys": "error",
  "no-const-assign": "error",
  "no-dupe-args": "error",
  "no-unreachable": "error",
  "no-use-before-define": ["error", { functions: false, classes: false, variables: false }],
};

export default [
  /* dist-m is the e2e harness's own build: a minified bundle nobody
     wrote and nothing here should read. */
  { ignores: ["dist/**", "dist-*/**", "node_modules/**", ".claude/**"] },
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
  /* The half that runs on a server, and the half that runs without a
     page. Neither is in the build, so nothing else looks at them at
     all — a mistyped name in the push relay would first be seen by a
     phone that never rang. */
  {
    files: ["netlify/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: CATCHES,
  },
  /* The Playwright suites are node, but the bodies they hand to
     page.evaluate run in the browser — both sets of globals are real
     here. */
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: CATCHES,
  },
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
  },
  {
    files: ["public/sw.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: { ...globals.serviceworker },
    },
    rules: CATCHES,
  },
];
