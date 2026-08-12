// Shared UI: a thin horizontal progress bar (used for onboarding step progress).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

interface Props {
  progress: number; // 0..1
  height?: number;
}

// Fills a track from 0 to 1 (input clamped) to show how far along something is.
export function ProgressBar({ progress, height = 6 }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, height, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: colors.primary,
  },
});
