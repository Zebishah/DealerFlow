import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist", "src/**/*.js", "src/**/*.jsx", "src/types/sales.ts"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        document: "readonly",
        window: "readonly",
        location: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        Headers: "readonly",
        URLSearchParams: "readonly",
        crypto: "readonly",
        Intl: "readonly",
        setTimeout: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-undef": "off",
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];
