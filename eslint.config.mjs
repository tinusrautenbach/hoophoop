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
    "next-env.d.ts",
    // AWS build artifacts
    "aws/dist/**",
    "aws/cli/**",
  ]),
  // eslint-plugin-react@7.x calls getFilename() (removed in ESLint v10) to detect the React version.
  // Providing the version explicitly in settings bypasses that code path entirely.
  {
    settings: {
      react: {
        version: "19",
      },
    },
    rules: {
      "react/display-name": "off",
    },
  },
]);

export default eslintConfig;
