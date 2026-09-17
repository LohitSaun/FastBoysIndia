import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useDeleteAccount } from '@/features/account/hooks';
import { selectPhone } from '@/features/auth/authSlice';
import { useSignOut } from '@/features/auth/hooks';
import { useActiveCities, useMyProfile } from '@/features/profile/hooks';
import { useDataSaver, useToggleDataSaver } from '@/features/settings/hooks';
import { useEmergencyContact, useSaveEmergencyContact } from '@/features/sos/hooks';
import { formatForDisplay, isValidNationalNumber, sanitizeNationalInput } from '@/lib/phone';
import { useAppSelector } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

export default function ProfileScreen() {
  const phone = useAppSelector(selectPhone);
  const { data: profile } = useMyProfile();
  const { data: cities } = useActiveCities();
  const signOut = useSignOut();

  const cityName = cities?.find((city) => city.id === profile?.home_city_id)?.name;

  return (
    <Screen edges={['top', 'right', 'left']} style={styles.screen} avoidKeyboard>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{profile?.display_name ?? 'Your profile'}</Text>

        <View style={styles.card}>
          <InfoRow label="Home city" value={cityName ?? '—'} />
          <View style={styles.divider} />
          <InfoRow label="Phone" value={phone ? formatForDisplay(phone) : '—'} />
        </View>

        <DataSaverSection />

        <EmergencyContactSection />

        <DeleteAccountSection />

        <View style={styles.footer}>
          {signOut.isError ? (
            <Text style={styles.error}>
              {"Couldn't sign out. Check your connection and try again."}
            </Text>
          ) : null}
          <Button
            title="Sign out"
            variant="secondary"
            onPress={() => signOut.mutate()}
            loading={signOut.isPending}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Deleting the account.
 *
 * Two confirmations, because it cannot be undone and there is no grace period.
 * The first says what goes and what doesn't; the second is the point of no
 * return.
 */
function DeleteAccountSection() {
  const deleteAccount = useDeleteAccount();

  const confirmFinal = () => {
    Alert.alert(
      'Last chance',
      "Everything is deleted straight away. There's no undo and no way to get the account back.",
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete it',
          style: 'destructive',
          onPress: () =>
            deleteAccount.mutate(undefined, {
              onError: () =>
                Alert.alert(
                  "Couldn't delete the account",
                  'Nothing has been deleted. Check your connection and try again.',
                ),
            }),
        },
      ],
    );
  };

  const start = () => {
    Alert.alert(
      'Delete your account?',
      [
        'This removes your profile, cars, photos, mods, drives, explored map, clips and crew memberships.',
        '',
        'A crew you own is handed to whoever joined it first, so your crew keeps going without you.',
        '',
        'Hazards you reported stay on the map, but stop being linked to you.',
      ].join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: confirmFinal },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Delete account</Text>
      <Text style={styles.hint}>
        Removes your account and everything in it, for good. This cannot be undone.
      </Text>
      <Button
        title="Delete my account"
        variant="secondary"
        onPress={start}
        loading={deleteAccount.isPending}
      />
    </View>
  );
}

/**
 * Data Saver.
 *
 * Mobile data in India is cheap but not unlimited, and plenty of people drive
 * on a fixed daily pack. This is a promise the app won't quietly spend it.
 */
function DataSaverSection() {
  const dataSaver = useDataSaver();
  const toggle = useToggleDataSaver();

  return (
    <View style={styles.section}>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.sectionTitle}>Data Saver</Text>
          <Text style={styles.hint}>
            {dataSaver
              ? 'Videos wait for a tap, car photos load when you open a car, and the map checks for hazards less often.'
              : 'Everything loads as normal.'}
          </Text>
        </View>
        <Switch
          value={dataSaver}
          onValueChange={() => {
            toggle();
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel="Data Saver"
        />
      </View>
    </View>
  );
}

/**
 * Who the SOS button sends to.
 *
 * This never leaves the phone — it's somebody else's number and they never
 * agreed to being in our database (see src/features/sos/contact.ts), which is
 * why it's edited here rather than saved alongside the profile.
 */
function EmergencyContactSection() {
  const contact = useEmergencyContact();
  const saveContact = useSaveEmergencyContact();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const saved = contact.data;

  const startEditing = () => {
    setName(saved?.name ?? '');
    setNumber(saved?.phone ?? '');
    setError(null);
    setEditing(true);
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Give them a name you would recognise in a hurry.');
      return;
    }
    if (!isValidNationalNumber(number)) {
      setError('That does not look like an Indian mobile number.');
      return;
    }

    setError(null);
    saveContact.mutate(
      { name: trimmedName, phone: number },
      { onSuccess: () => setEditing(false) },
    );
  };

  const handleRemove = () => {
    Alert.alert('Remove this contact?', 'The SOS button will use the share sheet instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => saveContact.mutate(null),
      },
    ]);
  };

  if (editing) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency contact</Text>
        <TextField
          label="Their name"
          value={name}
          onChangeText={setName}
          placeholder="Priya"
          autoCapitalize="words"
          maxLength={30}
        />
        <TextField
          label="Their mobile number"
          value={number}
          onChangeText={(text) => setNumber(sanitizeNationalInput(text))}
          placeholder="98765 43210"
          prefix="+91"
          keyboardType="number-pad"
          error={error}
        />
        <View style={styles.buttonRow}>
          <View style={styles.buttonHalf}>
            <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} />
          </View>
          <View style={styles.buttonHalf}>
            <Button title="Save" onPress={handleSave} loading={saveContact.isPending} />
          </View>
        </View>
        <Text style={styles.hint}>
          Kept on this phone only, never uploaded. A new phone means setting it again.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Emergency contact</Text>

      {saved ? (
        <>
          <View style={styles.card}>
            <InfoRow label={saved.name} value={formatForDisplay(saved.phone)} />
          </View>
          <View style={styles.buttonRow}>
            <View style={styles.buttonHalf}>
              <Button title="Change" variant="secondary" onPress={startEditing} />
            </View>
            <View style={styles.buttonHalf}>
              <Button title="Remove" variant="secondary" onPress={handleRemove} />
            </View>
          </View>
          <Text style={styles.hint}>
            SOS opens WhatsApp to {saved.name} with your location already written out.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            Set one and the SOS button goes straight to them. Without one it opens the share
            sheet so you can pick somebody.
          </Text>
          <Button title="Add a contact" variant="secondary" onPress={startEditing} />
        </>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 0,
  },
  container: {
    gap: spacing.lg,
    padding: spacing.lg,
    flexGrow: 1,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.md,
  },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  switchText: {
    flex: 1,
    gap: spacing.xs,
  },
  buttonHalf: {
    flex: 1,
  },
  footer: {
    marginTop: 'auto',
    gap: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
});
