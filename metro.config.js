// Metro is the bundler that turns our TypeScript into the JavaScript the app runs.
// Sentry's wrapper around Expo's default Metro config adds "debug IDs" to the bundle,
// so crash reports can be matched back to our original source lines.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
