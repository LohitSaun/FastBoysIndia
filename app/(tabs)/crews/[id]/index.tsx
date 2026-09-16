import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import type { CrewMember } from '@/features/crews/api';
import {
  useCrew,
  useCrewMembers,
  useDeleteCrew,
  useLeaveCrew,
  useRemoveMember,
} from '@/features/crews/hooks';
import { useActiveConvoy, useJoinConvoy, useStartConvoy } from '@/features/convoys/hooks';
import { useActiveCities } from '@/features/profile/hooks';
import { useAppSelector } from '@/store';
import { selectUserId } from '@/features/auth/authSlice';
import { colors, radius, spacing, typography } from '@/theme';

export default function CrewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const myUserId = useAppSelector(selectUserId);

  const crew = useCrew(id);
  const members = useCrewMembers(id);
  const cities = useActiveCities();

  const activeConvoy = useActiveConvoy(id);
  const startConvoy = useStartConvoy(id);
  const joinConvoy = useJoinConvoy(id);

  const leaveCrew = useLeaveCrew();
  const deleteCrew = useDeleteCrew();
  const removeMember = useRemoveMember(id);

  if (crew.isPending) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (crew.isError || !crew.data) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <Text style={styles.message}>{"Couldn't load this crew"}</Text>
        <Button title="Try again" onPress={() => crew.refetch()} loading={crew.isFetching} />
      </Screen>
    );
  }

  const data = crew.data;
  const isOwner = data.owner_id === myUserId;
  const cityName = cities.data?.find((city) => city.id === data.city_id)?.name ?? data.city_id;

  /** Opens the phone's share sheet, which includes WhatsApp. */
  const handleShare = () => {
    void Share.share({
      message: `Join my crew "${data.name}" on Fast Boys India. Use code ${data.invite_code} in the app.`,
    });
  };

  const handleLeave = () => {
    Alert.alert(`Leave ${data.name}?`, 'You can rejoin later with the code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => leaveCrew.mutate(data.id, { onSuccess: () => router.back() }),
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      `Delete ${data.name}?`,
      'Everyone is removed and the code stops working. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCrew.mutate(data.id, { onSuccess: () => router.back() }),
        },
      ],
    );
  };

  const handleRemoveMember = (member: CrewMember) => {
    const who = member.displayName ?? 'this member';
    Alert.alert(`Remove ${who}?`, 'They can rejoin with the code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeMember.mutate(member.userId),
      },
    ]);
  };

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      <Stack.Screen options={{ title: data.name }} />

      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.title}>{data.name}</Text>
          <Text style={styles.subtitle}>{cityName}</Text>
        </View>

        {/* ----------------------------------------------------- invite code */}
        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>Invite code</Text>
          <Text style={styles.inviteCode}>{data.invite_code}</Text>
          <Text style={styles.inviteHint}>
            Anyone with this code can join. Share it in WhatsApp and they type it in the app.
          </Text>
          <Button title="Share invite" onPress={handleShare} />
        </View>

        {/* ----------------------------------------------------------- drive */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drive</Text>

          {activeConvoy.data ? (
            <>
              <Text style={styles.hint}>A drive is running right now.</Text>
              <Button
                title="Open the live map"
                onPress={() =>
                  // Make sure we're on the participant list, then show the map.
                  joinConvoy.mutate(activeConvoy.data!.id, {
                    onSuccess: () =>
                      router.push({ pathname: '/crews/[id]/convoy', params: { id: data.id } }),
                  })
                }
                loading={joinConvoy.isPending}
              />
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                Starting a drive shares your location with this crew while the app is open.
              </Text>
              <Button
                title="Start a drive"
                onPress={() =>
                  startConvoy.mutate(undefined, {
                    onSuccess: () =>
                      router.push({ pathname: '/crews/[id]/convoy', params: { id: data.id } }),
                  })
                }
                loading={startConvoy.isPending}
              />
            </>
          )}
        </View>

        {/* --------------------------------------------------------- members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            <Text style={styles.sectionCount}>{members.data?.length ?? 0}</Text>
          </View>

          {members.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.memberList}>
              {(members.data ?? []).map((member) => (
                <View key={member.userId} style={styles.memberRow}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={18} color={colors.textMuted} />
                  </View>

                  <View style={styles.memberBody}>
                    <Text style={styles.memberName}>
                      {member.displayName ?? 'Someone'}
                      {member.userId === myUserId ? ' (you)' : ''}
                    </Text>
                    <Text style={styles.memberMeta}>
                      {[member.role === 'owner' ? 'Owner' : null, member.mainCar ?? 'No car yet']
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>

                  {isOwner && member.userId !== myUserId ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${member.displayName ?? 'member'}`}
                      onPress={() => handleRemoveMember(member)}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* --------------------------------------------------------- actions */}
        <View style={styles.section}>
          {isOwner ? (
            <Button
              title="Delete crew"
              variant="secondary"
              onPress={handleDelete}
              loading={deleteCrew.isPending}
            />
          ) : (
            <Button
              title="Leave crew"
              variant="secondary"
              onPress={handleLeave}
              loading={leaveCrew.isPending}
            />
          )}
          <Text style={styles.hint}>
            {isOwner
              ? 'You own this crew, so you delete it rather than leaving it.'
              : 'Leaving removes you from the list. You can rejoin with the code.'}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  message: { ...typography.body, color: colors.text },
  content: { padding: spacing.lg, gap: spacing.xl },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  inviteCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    alignItems: 'center',
  },
  inviteLabel: { ...typography.label, color: colors.textMuted },
  inviteCode: {
    ...typography.title,
    color: colors.primary,
    letterSpacing: 6,
  },
  inviteHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  section: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...typography.subtitle, color: colors.text },
  sectionCount: { ...typography.caption, color: colors.textMuted },
  memberList: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberBody: { flex: 1, gap: 2 },
  memberName: { ...typography.body, color: colors.text },
  memberMeta: { ...typography.caption, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.textMuted },
});
