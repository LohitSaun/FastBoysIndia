import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useMyCrews } from '@/features/crews/hooks';
import { useActiveCities } from '@/features/profile/hooks';
import { colors, radius, spacing, typography } from '@/theme';

export default function CrewsScreen() {
  const router = useRouter();
  const crews = useMyCrews();
  const cities = useActiveCities();

  const cityName = (cityId: string) =>
    cities.data?.find((city) => city.id === cityId)?.name ?? cityId;

  if (crews.isPending) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      <FlatList
        data={crews.data ?? []}
        keyExtractor={(crew) => crew.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={56} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No crews yet</Text>
            <Text style={styles.emptyText}>
              Start a crew and share its code, or join one with a code a friend sent you.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/crews/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cardSubtitle}>
                {cityName(item.city_id)} · code {item.invite_code}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        )}
      />

      <View style={styles.footer}>
        <Button title="Create crew" onPress={() => router.push('/crews/new')} />
        <Button title="Join with a code" variant="secondary" onPress={() => router.push('/crews/join')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: { ...typography.subtitle, color: colors.text },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.surfaceRaised },
  cardBody: { flex: 1, gap: spacing.xs },
  cardTitle: { ...typography.subtitle, color: colors.text },
  cardSubtitle: { ...typography.caption, color: colors.textMuted },
  footer: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
});
