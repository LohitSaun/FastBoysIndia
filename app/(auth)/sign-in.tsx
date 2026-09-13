import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { getAuthErrorMessage } from '@/features/auth/errors';
import { useSendOtp } from '@/features/auth/hooks';
import { isValidNationalNumber, sanitizeNationalInput, toE164 } from '@/lib/phone';
import { colors, spacing, typography } from '@/theme';

export default function SignInScreen() {
  const router = useRouter();
  const sendOtp = useSendOtp();
  // Just the 10 digits the user typed; "+91" is shown as a fixed prefix.
  const [nationalNumber, setNationalNumber] = useState('');

  const isComplete = nationalNumber.length === 10;
  const isValid = isValidNationalNumber(nationalNumber);

  let error: string | null = null;
  if (isComplete && !isValid) {
    error = 'Indian mobile numbers start with 6, 7, 8 or 9.';
  } else if (sendOtp.error) {
    error = getAuthErrorMessage(sendOtp.error);
  }

  const handleChange = (text: string) => {
    setNationalNumber(sanitizeNationalInput(text));
    // Clear an old "couldn't send" error as soon as they edit the number.
    if (sendOtp.isError) sendOtp.reset();
  };

  const handleSubmit = () => {
    const phone = toE164(nationalNumber);
    if (!phone) return;
    sendOtp.mutate(phone, {
      onSuccess: () => router.push('/verify'),
    });
  };

  return (
    <Screen avoidKeyboard>
      <View style={styles.header}>
        <Text style={styles.brand}>FAST BOYS INDIA</Text>
        {/* Text containing apostrophes goes inside {"..."}: the linter flags a bare ' in JSX,
            and HTML codes like &apos; don't work in React Native (they'd show up literally). */}
        <Text style={styles.title}>{"What's your number?"}</Text>
        <Text style={styles.subtitle}>
          {"We'll text you a 6-digit code. New here? This creates your account."}
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Mobile number"
          prefix="+91"
          value={nationalNumber}
          onChangeText={handleChange}
          placeholder="98765 43210"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          error={error}
        />
        <Button
          title="Send code"
          onPress={handleSubmit}
          disabled={!isValid}
          loading={sendOtp.isPending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  brand: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 2,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  form: {
    gap: spacing.lg,
  },
});
