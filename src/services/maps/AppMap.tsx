import MapView, { Marker, type Region } from 'react-native-maps';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

export type AppMapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  /** "me" is drawn in the app's orange; everyone else is plain. */
  kind: 'me' | 'other';
};

type AppMapProps = {
  markers: AppMapMarker[];
  /** Where to point the map when it first appears. */
  initialCenter?: { latitude: number; longitude: number } | null;
  style?: StyleProp<ViewStyle>;
};

/** Roughly a few streets across. */
const DEFAULT_SPAN = 0.02;

/**
 * The app's only map component.
 *
 * Screens use this rather than a map library directly, so that testing Mapbox
 * against Google or Apple maps later is a change in this one file. Today it
 * uses react-native-maps, which shows Apple Maps on iPhone and works in Expo Go.
 */
export function AppMap({ markers, initialCenter, style }: AppMapProps) {
  const anchor = initialCenter ?? markers[0] ?? null;

  const initialRegion: Region | undefined = anchor
    ? {
        latitude: anchor.latitude,
        longitude: anchor.longitude,
        latitudeDelta: DEFAULT_SPAN,
        longitudeDelta: DEFAULT_SPAN,
      }
    : undefined;

  return (
    <MapView
      style={[styles.map, style]}
      initialRegion={initialRegion}
      showsUserLocation={false}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
          title={marker.label}
          pinColor={marker.kind === 'me' ? colors.primary : undefined}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
