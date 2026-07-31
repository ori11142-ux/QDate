import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BIOMETRIC_CONSENT } from '../data/guidelines';
import { colors, radius, spacing, typography } from '../theme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  onConsent: () => void;
}

/** Full explanation of the biometric (face) processing, with opt-in / decline. */
function BiometricConsentModal({ visible, onClose, onConsent }: ModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{BIOMETRIC_CONSENT.title}</Text>
            <Text style={styles.sheetTag}>Optional · Biometric data</Text>
          </View>
          <ScrollView contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>{BIOMETRIC_CONSENT.summary}</Text>
            {BIOMETRIC_CONSENT.points.map((p, i) => (
              <View key={i} style={styles.point}>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.pointText}>{p}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.sheetActions}>
            <Pressable style={styles.consentBtn} onPress={onConsent}>
              <Text style={styles.consentBtnText}>I consent</Text>
            </Pressable>
            <Pressable style={styles.declineLink} onPress={onClose} hitSlop={8}>
              <Text style={styles.declineText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface Props {
  consented: boolean;
  onConsentedChange: (value: boolean) => void;
}

/**
 * Optional biometric-consent control for onboarding. Unchecked by default —
 * declining is fine (the user is then matched by interests only).
 */
export function BiometricConsent({ consented, onConsentedChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable style={styles.checkRow} onPress={() => onConsentedChange(!consented)} hitSlop={6}>
        <View style={[styles.checkbox, consented && styles.checkboxChecked]}>
          {consented && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.checkLabel}>
          {BIOMETRIC_CONSENT.summary}{' '}
          <Text style={styles.link} onPress={() => setModalOpen(true)}>
            Learn more
          </Text>
        </Text>
      </Pressable>
      <Text style={styles.optional}>Optional — you can be matched by your interests instead.</Text>

      <BiometricConsentModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onConsent={() => {
          onConsentedChange(true);
          setModalOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.textInverse, fontSize: 15, fontWeight: '700', lineHeight: 17 },
  checkLabel: { ...typography.body, color: colors.text, flex: 1, lineHeight: 21 },
  link: { color: colors.primaryDark, fontWeight: '600', textDecorationLine: 'underline' },
  optional: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, marginLeft: 32 },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '82%',
    paddingTop: spacing.lg,
  },
  sheetHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetTitle: { ...typography.title, color: colors.text },
  sheetTag: { ...typography.micro, color: colors.textMuted, marginTop: 2, letterSpacing: 0.5 },
  sheetScroll: { padding: spacing.lg, gap: spacing.md },
  intro: { ...typography.body, color: colors.text, lineHeight: 22, marginBottom: spacing.xs },
  point: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { ...typography.body, color: colors.primary, lineHeight: 21 },
  pointText: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 20 },
  sheetActions: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  consentBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  consentBtnText: { ...typography.heading, color: colors.textInverse },
  declineLink: { alignItems: 'center', paddingVertical: spacing.sm },
  declineText: { ...typography.body, color: colors.textMuted },
});
