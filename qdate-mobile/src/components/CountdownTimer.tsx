// A live countdown pill (re-renders every second) used for match expiry and the
// 7-day Phase-2 cooldown; calls onComplete once when it hits zero.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  expiresAt: string; // ISO timestamp
  compact?: boolean;
  onComplete?: () => void; // fired once when the countdown reaches zero
}

// Turns the milliseconds left into a human-readable string.
function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  // For multi-day windows (e.g. the 7-day Phase-2 cooldown / match expiry) show
  // days + h:m; under a day fall back to the familiar h:m:s.
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Displays the time left until `expiresAt`, ticking down once per second.
export function CountdownTimer({ expiresAt, compact, onComplete }: Props) {
  const targetMs = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(targetMs - Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [targetMs]);

  useEffect(() => {
    const id = setInterval(() => setRemaining(targetMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const expired = remaining <= 0;

  useEffect(() => {
    if (expired && !firedRef.current) {
      firedRef.current = true;
      onComplete?.();
    }
  }, [expired, onComplete]);

  return (
    <View style={[styles.pill, compact && styles.pillCompact, expired && styles.pillExpired]}>
      <Text style={[styles.text, compact && styles.textCompact]}>
        {expired ? 'Expired' : formatRemaining(remaining)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
  pillCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillExpired: {
    backgroundColor: colors.danger,
  },
  text: {
    ...typography.heading,
    color: colors.textInverse,
    fontVariant: ['tabular-nums'],
  },
  textCompact: {
    ...typography.caption,
    color: colors.textInverse,
    fontVariant: ['tabular-nums'],
  },
});
