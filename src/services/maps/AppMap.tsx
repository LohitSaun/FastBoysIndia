import MapView, { Marker, Polygon, Polyline, type Region } from 'react-native-maps';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

export type LatLng = { latitude: number; longitude: number };

export type AppMapMarker = LatLng & {
  id: string;
  label: string;
  /** "me" is drawn in the app's orange; everyone else is plain. */
  kind: 'me' | 'other';
};

type AppMapProps = {
  markers?: AppMapMarker[];
  /** Each entry is the four corners of one explored square. */
  exploredShapes?: LatLng[][];
  /** A single line, used to draw the drive being recorded. */
  path?: LatLng[];
  initialCenter?: LatLng | null;
  /** Called when the user stops panning or zooming. */
  onRegionSettled?: (region: Region) => void;
  style?: StyleProp<ViewStyle>;
};

/** Roughly a few streets across. */
const DEFAULT_SPAN = 0.02;

/**
 * The app's only map component.
 *
 * Screens never import a map library directly, so trying Mapbox against Apple
 * or Google maps later is a change to this file alone. Today it uses
 * react-native-maps, which is Apple Maps on iPhone and works in Expo Go.
 */
export function AppMap({
  markers = [],
  exploredShapes = [],
  path,
  initialCenter,
  onRegionSettled,
  style,
}: AppMapProps) {
  const anchor = initialCenter ?? markers[0] ?? path?.[0] ?? null;

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
      onRegionChangeComplete={onRegionSettled}
      showsUserLocation={false}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {exploredShapes.map((corners, index) => (
        <Polygon
          key={`square-${index}`}
          coordinates={corners}
          fillColor="rgba(255, 90, 31, 0.28)"
          strokeColor="rgba(255, 90, 31, 0.15)"
          strokeWidth={1}
        />
      ))}

      {path && path.length >= 2 ? (
        <Polyline coordinates={path} strokeColor={colors.primary} strokeWidth={4} />
      ) : null}

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
