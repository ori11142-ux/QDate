import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { REPORT_CATEGORIES } from '../data/guidelines';
import { colors, radius, spacing, typography } from '../theme';

const REASON_MAX = 300;

interface Props {
  visible: boolean;
  reportedName?: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (category: string, reason: string) => void;
}

export function ReportUserModal({
  visible,
  reportedName,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const [category, setCategory] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setCategory(null);
      setReason('');
    }
  }, [visible]);

  const who = reportedName ?? 'this person';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Report {who}</Text>
            <Text style={styles.subtitle}>
              Tell us what's happening. Reports are confidential and checked against our
              community guidelines.
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionLabel}>What's the issue?</Text>
            {REPORT_CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => setCategory(cat.id)}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}

            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
              Add details (optional)
            </Text>
            <TextInput
              value={reason}
              onChangeText={(v) => setReason(v.slice(0, REASON_MAX))}
              placeholder="What happened?"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              maxLength={REASON_MAX}
            />
            <Text style={styles.counter}>
              {reason.length}/{REASON_MAX}
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={[styles.submitBtn, (!category || submitting) && styles.submitBtnDisabled]}
              onPress={() => category && onSubmit(category, reason.trim())}
              disabled={!category || submitting}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? 'Submitting…' : 'Submit report'}
              </Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onClose} hitSlop={8} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '86%',
    paddingTop: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 19 },

  scroll: { padding: spacing.lg },
  sectionLabel: {
    ...typography.micro,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionLabel: { ...typography.body, color: colors.text, flex: 1 },
  optionLabelActive: { color: colors.text, fontWeight: '600' },

  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 70,
    textAlignVertical: 'top',
    ...typography.body,
    color: colors.text,
  },
  counter: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'right' },

  actions: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  submitBtn: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { ...typography.heading, color: colors.textInverse },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { ...typography.body, color: colors.textMuted },
});
