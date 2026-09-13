import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

type TextFieldProps = TextInputProps & {
  label: string;
  /** Shown in red under the field. */
  error?: string | null;
  /** Fixed text in front of the input, e.g. "+91". */
  prefix?: string;
};

export function TextField({ label, error, prefix, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          accessibilityLabel={label}
          {...inputProps}
        />
      </View>
      {error ? (
        // "polite" makes screen readers announce the error when it appears.
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputRowError: {
    borderColor: colors.danger,
  },
  prefix: {
    ...typography.subtitle,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  input: {
    ...typography.subtitle,
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
