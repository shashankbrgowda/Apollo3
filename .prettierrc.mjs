/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const config = {
  semi: false,
  singleQuote: true,
  proseWrap: 'always',
  overrides: [
    {
      files: ['.devcontainer/**/*.json', '.vscode/*.json', '**/tsconfig*.json'],
      options: { parser: 'jsonc' },
    },
  ],
}

export default config