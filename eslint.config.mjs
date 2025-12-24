import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint 설정
 * [C-005] no-console 규칙으로 민감정보 콘솔 로깅 방지
 */
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
  ]),
  // 커스텀 규칙
  {
    rules: {
      // console.log 사용 금지 (logger.ts 사용 강제)
      // error/warn은 logger.ts에서만 허용
      "no-console": [
        "error",
        {
          allow: ["warn", "error"], // logger.ts 내부에서만 사용
        },
      ],
      // TypeScript 관련 규칙
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // 보안 관련 규칙
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
    },
  },
]);

export default eslintConfig;
