import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChipGroup } from '@/components/ChipGroup';
import { Screen } from '@/components/Screen';
import { useMyCrews } from '@/features/crews/hooks';
import { currentMonth, type LeaderboardEntry } from '@/features/leaderboards/api';
import { useCityLeaderboard, useCrewLeaderboard } from '@/features/leaderboards/hooks';
import { useActiveCities, useMyProfile } from '@/features/profile/hooks';
import { formatDistance } from '@/features/trips/grid';
import { useExploredCount, useTripStats } from '@/features/trips/hooks';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Worked out once when the app loads, not while rendering: reading the clock
 * during a render would make the same render give different answers. The cost
 * is that an app left open across midnight on the 1st still says the old month,
 * which nobody will notice.
 */
const THIS_MONTH = currentMonth();

const BOARDS = [
  { value: 'city', label: 'My city' },
  { value: 'crew', label: 'My crew' },
] as const;

const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
] as const;

type Board = (typeof BOARDS)[number]['value'];
type Period = (typeof PERIODS)[number]['value'];

/** Gold, silver, bronze for the top three; everyone else gets plain text. */
const PODIUM = ['#FFD24A', '#CFD4DC', '#D9884A'];

export default function RanksScreen() {
  const router = useRouter();
  const [board, setBoard] = useState<Board>('city');
  const [period, setPeriod] = useState<Period>('all');
  const [pickedCrewId, setPickedCrewId] = useState<string | null>(null);

  const profile = useMyProfile();
  const cities = useActiveCities();
  const crews = useMyCrews();
  const myStats = useTripStats();
  const myExplored = useExploredCount();

  // No crew chosen yet? Show the first one rather than nothing.
  const crewId = pickedCrewId ?? crews.data?.[0]?.id ?? null;
  const dbPeriod = period === 'all' ? 'all' : THIS_MONTH;

  const cityBoard = useCityLeaderboard(
    board === 'city' ? profile.data?.home_city_id : null,
    dbPeriod,
  );
  const crewBoard = useCrewLeaderboard(board === 'crew' ? crewId : null, dbPeriod);

  const active = board === 'city' ? cityBoard : crewBoard;
  const rows = active.data ?? [];
  const youAreListed = rows.some((row) => row.isYou);

  const cityName = cities.data?.find((city) => city.id === profile.data?.home_city_id)?.name;
  const heading = board === 'city' ? (cityName ?? 'Your city') : 'Your crew';

  const hasNoCrew = board === 'crew' && crews.isSuccess && (crews.data?.length ?? 0) === 0;

  return (
    <Screen edges={['top', 'right', 'left']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Ranks</Text>
        <Text style={styles.subtitle}>{heading} · ranked on distance driven</Text>

        <ChipGroup options={BOARDS} selected={board} onSelect={setBoard} />
        <ChipGroup options={PERIODS} selected={period} onSelect={setPeriod} />

        {/* Only worth showing when there's actually a choice to make. */}
        {board === 'crew' && (crews.data?.length ?? 0) > 1 ? (
          <ChipGroup
            options={(crews.data ?? []).map((crew) => ({ value: crew.id, label: crew.name }))}
            selected={crewId}
            onSelect={setPickedCrewId}
          />
        ) : null}
      </View>

      {hasNoCrew ? (
        <EmptyState
          icon="people-outline"
          title="No crew yet"
          hint="Create or join a crew and you can race your mates on distance."
          action={{ label: 'Go to Crews', onPress: () => router.push('/crews') }}
        />
      ) : active.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : active.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load the board"
          hint="Check your connection and pull down to try again."
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.userId}
          contentContainerStyle={styles.list}
          refreshing={active.isFetching}
          onRefresh={() => active.refetch()}
          ListEmptyComponent={
            <EmptyState
              icon="speedometer-outline"
              title="Nobody has driven yet"
              hint={
                period === 'month'
                  ? 'No drives recorded this month. Record one and you top the board.'
                  : 'Record a drive from the Explored tab to get on the board.'
              }
            />
          }
          renderItem={({ item, index }) => <Row entry={item} position={index + 1} />}
          ListFooterComponent={
            rows.length > 0 && !youAreListed ? (
              <Text style={styles.hint}>
                {`You're not on this board yet — ${formatDistance(myStats.data?.total_distance_m ?? 0)}, ${myExplored.data ?? 0} squares so far.`}
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

function Row({ entry, position }: { entry: LeaderboardEntry; position: number }) {
  const podiumColour = PODIUM[position - 1];

  return (
    <View style={[styles.row, entry.isYou && styles.rowYou]}>
      <Text style={[styles.position, podiumColour ? { color: podiumColour } : null]}>
        {position}
      </Text>

      <View style={styles.rowBody}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.displayName}
          </Text>
          {entry.isYou ? <Text style={styles.youPill}>You</Text> : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {[entry.mainCar, `${entry.squares} squares`, `${entry.trips} drives`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      <Text style={styles.distance}>{formatDistance(entry.distanceM)}</Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: 'people-outline' | 'speedometer-outline' | 'cloud-offline-outline';
  title: string;
  hint: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={52} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress}>
          <Text style={styles.link}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  header: { padding: spacing.lg, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowYou: { borderColor: colors.primary, backgroundColor: colors.surfaceRaised },
  position: {
    ...typography.subtitle,
    color: colors.textMuted,
    minWidth: 28,
    textAlign: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.label, color: colors.text, flexShrink: 1 },
  youPill: {
    ...typography.caption,
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    fontWeight: '700',
    overflow: 'hidden',
  },
  meta: { ...typography.caption, color: colors.textMuted },
  distance: { ...typography.label, color: colors.text },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: { ...typography.subtitle, color: colors.text },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingTop: spacing.md,
  },
  link: { ...typography.label, color: colors.primary, paddingTop: spacing.sm },
});
