import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Which edges to keep clear of the notch / home indicator.
   * Tab screens leave out 'bottom' because the tab bar already handles it.
   */
  edges?: Edge[];
  /** Lift content above the on-screen keyboard. Use on screens with text inputs. */
  avoidKeyboard?: boolean;
};

/** The standard wrapper for every screen: dark background, safe-area padding, consistent margins. */
export function Screen({
  children,
  style,
  edges = ['top', 'right', 'bottom', 'left'],
  avoidKeyboard = false,
}: ScreenProps) {
  const content = <View style={[styles.content, style]}>{children}</View>;

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      {avoidKeyboard ? (
        // iOS needs "padding" to move content up. Android resizes the window for the
        // keyboard on its own, so we leave it alone there.
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
});
