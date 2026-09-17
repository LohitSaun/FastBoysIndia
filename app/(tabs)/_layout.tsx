import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// What the tab bar passes to each icon. `ColorValue` (not `string`) is React Native's
// type for colours, because a colour can also be a platform-specific system colour.
type TabIconProps = { color: ColorValue; size: number; focused: boolean };

/**
 * Builds a tab icon that's filled when the tab is selected and outlined when it isn't.
 * Browse icon names at https://icons.expo.fyi (filter by Ionicons).
 */
function tabIcon(selected: IconName, unselected: IconName) {
  return function TabIcon({ color, size, focused }: TabIconProps) {
    return <Ionicons name={focused ? selected : unselected} size={size} color={color} />;
  };
}

/**
 * The main app's bottom tab bar. The file names in this folder become the tabs;
 * index.tsx is the first one (Feed).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Feed', tabBarIcon: tabIcon('play-circle', 'play-circle-outline') }}
      />
      <Tabs.Screen
        name="crews"
        options={{ title: 'Crews', tabBarIcon: tabIcon('people', 'people-outline') }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Map', tabBarIcon: tabIcon('map', 'map-outline') }}
      />
      <Tabs.Screen
        name="ranks"
        options={{ title: 'Ranks', tabBarIcon: tabIcon('trophy', 'trophy-outline') }}
      />
      <Tabs.Screen
        name="garage"
        options={{ title: 'Garage', tabBarIcon: tabIcon('car-sport', 'car-sport-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }}
      />
    </Tabs>
  );
}
