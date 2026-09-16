import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useJoinCrew } from '@/features/crews/hooks';
import { colors, spacing, typography } from '@/theme';

const CODE_LENGTH = 6;

export default function JoinCrewScreen() {
  const router = useRouter();
  const joinCrew = useJoinCrew();
  const [code, setCode] = useState('');

  // Codes are uppercase letters and digits; tidy up whatever gets typed or pasted.
  const handleChange = (text: string) => {
    setCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH));
    if (joinCrew.isError) joinCrew.reset();
  };

  const handleSubmit = () => {
    if (code.length !== CODE_LENGTH) return;
    joinCrew.mutate(code, {
      onSuccess: (crewId) => router.replace({ pathname: '/crews/[id]', params: { id: crewId } }),
    });
  };

  return (
    <Screen edges={['left', 'right']} avoidKeyboard style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Ask whoever runs the crew for its 6-character code, then type it here.
        </Text>

        <TextField
          label="Invite code"
          value={code}
          onChangeText={handleChange}
          placeholder="ABC123"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CODE_LENGTH}
          autoFocus
          style={styles.codeInput}
          error={joinCrew.isError ? 'No crew found with that code. Check it and try again.' : null}
        />

        <Button
          title="Join crew"
          onPress={handleSubmit}
          disabled={code.length !== CODE_LENGTH}
          loading={joinCrew.isPending}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  content: { padding: spacing.lg, gap: spacing.lg },
  intro: { ...typography.body, color: colors.textMuted },
  codeInput: { letterSpacing: 6, fontWeight: '700' },
});
