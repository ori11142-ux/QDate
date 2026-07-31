import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface Props {
  value: { min: number; max: number };
  onChange: (v: { min: number; max: number }) => void;
}

function clampAge(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(18, Math.min(99, Math.round(n)));
}

/**
 * Two number inputs for a preferred age range (18–99). Clamps and enforces
 * min ≤ max when a field loses focus, committing the result to the parent.
 */
export function AgeRangePicker({ value, onChange }: Props) {
  const [minStr, setMinStr] = useState(String(value.min));
  const [maxStr, setMaxStr] = useState(String(value.max));

  function commit(rawMin: string, rawMax: string) {
    let min = clampAge(parseInt(rawMin, 10), 18);
    let max = clampAge(parseInt(rawMax, 10), 99);
    if (max < min) max = min;
    setMinStr(String(min));
    setMaxStr(String(max));
    onChange({ min, max });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>From</Text>
        <TextInput
          style={styles.input}
          value={minStr}
          onChangeText={(t) => setMinStr(t.replace(/\D/g, '').slice(0, 2))}
          onBlur={() => commit(minStr, maxStr)}
          onEndEditing={() => commit(minStr, maxStr)}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
        />
      </View>
      <Text style={styles.to}>to</Text>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>To</Text>
        <TextInput
          style={styles.input}
          value={maxStr}
          onChangeText={(t) => setMaxStr(t.replace(/\D/g, '').slice(0, 2))}
          onBlur={() => commit(minStr, maxStr)}
          onEndEditing={() => commit(minStr, maxStr)}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
        />
      </View>
      <Text style={styles.years}>years</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.caption, color: colors.textMuted, letterSpacing: 0.3 },
  input: {
    width: 64,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlign: 'center',
    ...typography.body,
    color: colors.text,
  },
  to: { ...typography.body, color: colors.textMuted, paddingBottom: spacing.md },
  years: { ...typography.body, color: colors.textMuted, paddingBottom: spacing.md },
});
