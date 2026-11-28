import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react/jsx-tag-spacing": ["error", { closingSlash: "never", beforeSelfClosing: "never", afterOpening: "never", beforeClosing: "never" }]
    }
  },
  globalIgnores([".next/**", "out/**", "build/**", ".worktrees/**", "next-env.d.ts"])
]);
