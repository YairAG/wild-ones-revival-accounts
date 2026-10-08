const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = [
  { ignores: ["node_modules/", "dist/"] },
  js.configs.recommended,
  { files: ["*.js"], languageOptions: { sourceType: "commonjs", globals: { require: "readonly", module: "writable" } } },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["**/*.ts"] })),
  {
    files: ["**/*.ts"],
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
];
