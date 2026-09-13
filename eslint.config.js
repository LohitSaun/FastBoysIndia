// Expo's recommended lint rules: https://docs.expo.dev/guides/using-eslint/
// Run with `npm run lint`.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/*'],
  },
]);
