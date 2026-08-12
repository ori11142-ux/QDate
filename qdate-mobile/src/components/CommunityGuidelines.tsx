// Community-guidelines UI: the rules list, a full-screen modal, and the
// onboarding "I agree" checkbox — all sharing one styled list of rules.
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COMMUNITY_RULES, GUIDELINES_VERSION } from '../data/guidelines';
import { colors, radius, spacing, typography } from '../theme';

/** Scrollable list of the community rules. Reused by the modal and onboarding. */
export function GuidelinesList() {
  return (
    <View style={styles.list}>
      {COMMUNITY_RULES.map((rule, i) => (
        <View key={rule.id} style={styles.rule}>
          <View style={styles.ruleNum}>
            <Text style={styles.ruleNumText}>{i + 1}</Text>
          </View>
          <View style={styles.ruleBody}>
            <Text style={styles.ruleTitle}>{rule.title}</Text>
            <Text style={styles.ruleText}>{rule.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  /** When provided, shows an "I agree" button that calls this then closes. */
  onAgree?: () => void;
}

/** Full-screen, read-only (or agree-able) view of the community guidelines. */
export function GuidelinesModal({ visible, onClose, onAgree }: ModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Community Guidelines</Text>
            <Text style={styles.sheetVersion}>Version {GUIDELINES_VERSION}</Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.intro}>
              QDate is built on respect and safety. By using QDate you agree to follow
              these rules. Breaking them can lead to a warning, suspension, or a ban.
            </Text>
            <GuidelinesList />
          </ScrollView>
          <View style={styles.sheetActions}>
            {onAgree ? (
              <>
                <Pressable style={styles.agreeBtn} onPress={onAgree}>
                  <Text style={styles.agreeBtnText}>I agree</Text>
                </Pressable>
                <Pressable style={styles.closeLink} onPress={onClose} hitSlop={8}>
                  <Text style={styles.closeLinkText}>Not now</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.agreeBtn} onPress={onClose}>
                <Text style={styles.agreeBtnText}>Close</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface AgreementProps {
  agreed: boolean;
  onAgreedChange: (value: boolean) => void;
}

/**
 * Inline "sign the guidelines" control for onboarding: a checkbox the user must
 * tick, plus a link that opens the full rules.
 */
export function GuidelinesAgreement({ agreed, onAgreedChange }: AgreementProps) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <View style={styles.agreement}>
      <Pressable
        style={styles.checkRow}
        onPress={() => onAgreedChange(!agreed)}
        hitSlop={6}
      >
        <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
          {agreed && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.checkLabel}>
          I have read and agree to the{' '}
          <Text
            style={styles.link}
            onPress={() => setModalOpen(true)}
          >
            Community Guidelines
          </Text>
          .
        </Text>
      </Pressable>

      <GuidelinesModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onAgree={() => {
          onAgreedChange(true);
          setModalOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // List
  list: { gap: spacing.md },
  rule: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  ruleNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  ruleNumText: { ...typography.caption, color: colors.textInverse, fontWeight: '700' },
  ruleBody: { flex: 1, gap: 2 },
  ruleTitle: { ...typography.heading, color: colors.text },
  ruleText: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },

  // Modal
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '86%',
    paddingTop: spacing.lg,
  },
  sheetHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetTitle: { ...typography.title, color: colors.text },
  sheetVersion: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
  sheetScroll: { padding: spacing.lg, gap: spacing.md },
  intro: { ...typography.body, color: colors.textMuted, lineHeight: 21, marginBottom: spacing.sm },
  sheetActions: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  agreeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  agreeBtnText: { ...typography.heading, color: colors.textInverse },
  closeLink: { alignItems: 'center', paddingVertical: spacing.sm },
  closeLinkText: { ...typography.body, color: colors.textMuted },

  // Agreement
  agreement: { marginTop: spacing.md },
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
});
