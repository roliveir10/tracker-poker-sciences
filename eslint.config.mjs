import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      ".vercel/**",
      "next-env.d.ts",
      "**/*.d.ts",
      "src/types/**/*.d.ts",
      "prisma/**",
      "**/.prisma/**",
      "**/generated/**",
      "src/generated/**",
      "src/generated/prisma/**",
    ],
  },
  // Global rule tweaks
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ],
    },
  },
  // Declaration files: turn off strict rules that are noisy for typings
  {
    files: ["**/*.d.ts", "src/types/**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Generated/build/prisma artifacts: disable lint rules entirely
  {
    files: [
      "prisma/**",
      "**/.prisma/**",
      "**/generated/**",
      "src/generated/**",
      "src/generated/prisma/**",
      "**/dist/**",
      "**/build/**",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  // Specific generated JS that uses CommonJS require
  {
    files: ["src/generated/prisma/**/*.js", "src/generated/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
