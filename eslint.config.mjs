import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "build/**",
      "scripts/**",
      "**/*.config.*",
    ],
  },
];

export default eslintConfig;
