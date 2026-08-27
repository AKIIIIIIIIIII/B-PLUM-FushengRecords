import js from "@eslint/js";
import next from "@next/eslint-plugin-next";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", ".next/**", ".wrangler/**", "node_modules/**", "next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,mjs}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "@next/next": next, react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...next.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.flat.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
    },
  },
);
