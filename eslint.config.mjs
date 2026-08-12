import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "**/.next/**",
      ".next-build/**",
      "**/.next-build/**",
      ".next-dev-*/**",
      "**/.next-dev-*/**",
      "out/**",
      "**/out/**",
      "dist/**",
      "coverage/**",
      "generated/**",
      "**/generated/**",
      "**/next-env.d.ts",
      "**/*.mjs"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["scripts/*.ts"]
        },
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
    // These redirect() calls cast their target through `never` because
    // apps/web/app/admin/*/page.tsx redirect to an external cross-app URL
    // that typedRoutes' Route<string> literal check can never match. Whether
    // that cast reads as "necessary" depends on whether .next/types has been
    // generated yet, which varies by task ordering (lint runs after this
    // app's own build; typecheck does not depend on it). Disabling the rule
    // here keeps both task orderings green instead of chasing a flag that
    // flips depending on build state.
    files: ["apps/web/app/admin/**/page.tsx"],
    rules: {
      "@typescript-eslint/no-unnecessary-type-assertion": "off"
    }
  }
];
