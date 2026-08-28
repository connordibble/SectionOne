import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // Local agent worktrees can contain their own generated .next output.
    // They are not part of this checkout's source or release surface.
    ".claude/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
