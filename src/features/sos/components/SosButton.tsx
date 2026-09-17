import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HoldButton } from '@/components/HoldButton';
import type { DrivePosition } from '@/services/location';
import { colors, spacing, typography } from '@/theme';

import { useSendSos } from '../hooks';

type SosButtonProps = {
  /**
   * A position the screen already has, so a drive in progress doesn't wait for
   * a fresh GPS fix. Left out, the button asks for one itself.
   */
  knownPosition?: DrivePosition | null;
};

/**
 * The SOS button, used on both the solo map and a crew drive.
 *
 * It says "Share my location", not "Get help", because that is exactly what it
 * does: it hands a message to WhatsApp or the share sheet and a person chooses
 * who receives it. Nothing is sent by us, nothing is stored, and nothing
 * reaches the emergency services.
 */
export function SosButton({ knownPosition }: SosButtonProps) {
  const { send, contact } = useSendSos();
  const [problem, setProblem] = useState<string | null>(null);

  const handleHoldComplete = async () => {
    const outcome = await send(knownPosition);

    if (outcome.sent) {
      // It went, but without a position — worth saying, because the person
      // receiving it can't come and find you.
      setProblem(
        outcome.withLocation
          ? null
          : "Sent, but your phone couldn't work out where you are. Say where you are yourself.",
      );
      return;
    }
    // Backing out of the share sheet is a normal thing to do, not an error.
    setProblem(
      outcome.reason === 'cancelled'
        ? null
        : "Couldn't open anything to send with. Ring somebody directly.",
    );
  };

  return (
    <View style={styles.container}>
      <HoldButton
        title="Hold for SOS"
        holdingTitle="Keep holding to send…"
        onHoldComplete={() => {
          void handleHoldComplete();
        }}
      />
      <Text style={styles.hint}>
        {contact
          ? `Opens WhatsApp to ${contact.name} with where you are. You still press send.`
          : 'Opens the share sheet with where you are. Add an emergency contact in Profile to skip a step.'}
      </Text>
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  problem: { ...typography.caption, color: colors.danger, textAlign: 'center' },
});
