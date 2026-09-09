import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "drizzle/**", "node_modules/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-namespace": "off",
      "no-console": ["error", { allow: ["warn", "error", "log"] }],
    },
  },
);
