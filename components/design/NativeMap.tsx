/**
 * NativeMap — native platform re-export of react-native-maps.
 *
 * Metro automatically picks `NativeMap.web.tsx` on web (where react-native-maps
 * has no working implementation) and this file on iOS / Android. Screens import
 * `MapView` / `Marker` / `PROVIDER_GOOGLE` from here instead of from
 * `react-native-maps` directly, so the web bundle never pulls the native module.
 */
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export { MapView, Marker, PROVIDER_GOOGLE };
export default MapView;
