const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK v10 + Expo SDK 53+ : the default Metro package-exports
// resolution picks Firebase's *browser* build of `firebase/auth`, which lacks
// `getReactNativePersistence` → "Component auth has not been registered yet".
//
// Keep package exports ENABLED (so modern packages like expo-linking still
// resolve), but drop the "browser" condition so Firebase resolves to its
// React-Native build instead. `.cjs` is also allowed for Firebase's CJS files.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

module.exports = withNativeWind(config, { input: './global.css' });
