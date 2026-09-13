import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { selectPendingPhone } from '@/features/auth/authSlice';
import { getAuthErrorMessage } from '@/features/auth/errors';
import { useSendOtp, useVerifyOtp } from '@/features/auth/hooks';
import { formatForDisplay } from '@/lib/phone';
import { formatSeconds, useCountdown } from '@/lib/useCountdown';
import { useAppSelector } from '@/store';
import { colors, spacing, typography } from '@/theme';

const CODE_LENGTH = 6;
// Supabase allows one code per number every 60 seconds by default.
const RESEND_AFTER_SECONDS = 60;

export default function VerifyScreen() {
  const router = useRouter();
  const phone = useAppSelector(selectPendingPhone);
  const verifyOtp = useVerifyOtp();
  const resendOtp = useSendOtp();
  const { secondsLeft, restart } = useCountdown(RESEND_AFTER_SECONDS);
  const [code, setCode] = useState('');

  // If the app was reloaded on this screen, we no longer know which number to verify.
  if (!phone) {
    return <Redirect href="/sign-in" />;
  }

  const submit = (token: string) => {
    if (token.length !== CODE_LENGTH || verifyOtp.isPending) return;
    // No onSuccess navigation needed: signing in flips the auth state and the root
    // layout moves the user on automatically.
    verifyOtp.mutate({ phone, token });
  };

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (verifyOtp.isError) verifyOtp.reset();
    // Submit as soon as the 6th digit arrives, including SMS autofill.
    if (digits.length === CODE_LENGTH) submit(digits);
  };

  const handleResend = () => {
    resendOtp.mutate(phone, {
      onSuccess: () => {
        restart();
        setCode('');
        verifyOtp.reset();
      },
    });
  };

  const errorSource = verifyOtp.error ?? resendOtp.error;
  const canResend = secondsLeft === 0 && !resendOtp.isPending;

  return (
    <Screen avoidKeyboard>
      <View style={styles.header}>
        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.subtitle}>Sent by SMS to {formatForDisplay(phone)}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.link}>Change number</Text>
        </Pressable>
      </View>

      <View style={styles.form}>
        <TextField
          label="6-digit code"
          value={code}
          onChangeText={handleChange}
          placeholder="••••••"
          keyboardType="number-pad"
          // iOS and Android can offer the code from the SMS right above the keyboard.
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={CODE_LENGTH}
          style={styles.codeInput}
          error={errorSource ? getAuthErrorMessage(errorSource) : null}
        />
        <Button
          title="Verify"
          onPress={() => submit(code)}
          disabled={code.length !== CODE_LENGTH}
          loading={verifyOtp.isPending}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canResend }}
          disabled={!canResend}
          onPress={handleResend}
          style={styles.resend}
        >
          <Text style={[styles.link, !canResend && styles.linkDisabled]}>
            {secondsLeft > 0 ? `Resend code in ${formatSeconds(secondsLeft)}` : 'Resend code'}
          </Text>
        </Pressable>
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
  codeInput: {
    letterSpacing: 8,
  },
  resend: {
    alignSelf: 'center',
    padding: spacing.sm,
  },
  link: {
    ...typography.label,
    color: colors.primary,
  },
  linkDisabled: {
    color: colors.textMuted,
  },
});
