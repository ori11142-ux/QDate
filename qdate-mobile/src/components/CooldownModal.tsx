import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CooldownModal({ visible, onCancel, onConfirm }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconBubble}>
            <Text style={styles.iconText}>⏳</Text>
          </View>

          <Text style={styles.title}>Skip your curated match?</Text>
          <Text style={styles.body}>
            This is a curated, high-intentionality pairing. If you skip it, your{' '}
            <Text style={styles.bodyBold}>next curated match won&apos;t arrive for 7 days</Text>.
          </Text>
          <Text style={styles.body}>Take your time before deciding.</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.btnPrimaryLabel}>Reconsider</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.btnGhostLabel}>Skip anyway</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 45, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 380,
    gap: spacing.md,
    alignItems: 'center',
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  iconText: { fontSize: 32 },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  bodyBold: { fontWeight: '700', color: colors.danger },
  actions: { width: '100%', gap: spacing.sm, marginTop: spacing.md },
  btn: {
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryLabel: { ...typography.heading, color: colors.textInverse },
  btnGhost: { backgroundColor: 'transparent' },
  btnGhostLabel: { ...typography.body, color: colors.textMuted },
  pressed: { opacity: 0.85 },
});
