/**
 * Dynamic Expo config.
 * Extends app.json and injects the Google Maps API key from the environment
 * (.env locally, the EAS build profile env in the cloud) so no secret ever
 * lives in version control.
 */
module.exports = ({ config }) => {
  const mapsKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ??
    '';

  return {
    ...config,
    ios: {
      ...config.ios,
      ...(mapsKey ? { config: { ...(config.ios?.config ?? {}), googleMapsApiKey: mapsKey } } : {}),
    },
    android: {
      ...config.android,
      ...(mapsKey
        ? { config: { ...(config.android?.config ?? {}), googleMaps: { apiKey: mapsKey } } }
        : {}),
    },
  };
};
