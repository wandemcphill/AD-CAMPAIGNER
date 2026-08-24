import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**", ".next/**", "**/.next/**", ".next-build/**", "**/.next-build/**", ".next-dev-*/**", "**/.next-dev-*/**", "out/**", "**/out/**", "dist/**", "coverage/**", "generated/**", "**/generated/**", "**/next-env.d.ts", "**/*.mjs"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["scripts/*.ts"] },
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
    }
  },
  {
    files: ["apps/web/app/admin/**/page.tsx"],
    rules: { "@typescript-eslint/no-unnecessary-type-assertion": "off" }
  },
  {
    files: ["apps/web/app/marketing/fliptribe-homepage.tsx"],
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }] }
  }
];
