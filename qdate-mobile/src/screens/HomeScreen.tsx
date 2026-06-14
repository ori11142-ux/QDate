import React, { useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { DAILY_TIPS, getTodaysTip } from '../data/tips';
import { colors, radius, spacing, typography } from '../theme';

export function HomeScreen() {
  const { user } = useAuth();
  const [tipIndex, setTipIndex] = useState(() =>
    DAILY_TIPS.indexOf(getTodaysTip())
  );

  const tip = DAILY_TIPS[tipIndex];

  function handleNextTip() {
    setTipIndex((i) => (i + 1) % DAILY_TIPS.length);
  }

  const greeting = getTimeGreeting();
  const phaseLabel =
    user?.currentPhase === 'phase_2'
      ? 'Phase 2 · Curated weekly matches'
      : 'Phase 1 · Learning Period';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              {greeting}{user ? `, ${user.name.split(' ')[0]}` : ''}
            </Text>
            <Text style={styles.phase}>{phaseLabel}</Text>
          </View>
          <View style={styles.avatar}>
            {user?.photoUrl ? (
              <Image source={{ uri: user.photoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipKicker}>Tip for today</Text>
          <Text style={styles.tipTitle}>{tip.title}</Text>
          <Text style={styles.tipBody}>{tip.body}</Text>

          <View style={styles.tipFooter}>
            <Pressable onPress={handleNextTip} hitSlop={8} style={styles.nextTipBtn}>
              <Text style={styles.nextTipLabel}>Another tip →</Text>
            </Pressable>
            <Text style={styles.tipCount}>
              {tipIndex + 1} / {DAILY_TIPS.length}
            </Text>
          </View>
        </View>

        <View style={styles.philosophy}>
          <Text style={styles.philosophyKicker}>The QDate philosophy</Text>
          <Text style={styles.philosophyBody}>
            One match at a time. Real attention beats infinite options. The system is
            learning what you actually want — not what you say you want.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Hi';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: {
    ...typography.title,
    color: colors.primary,
  },
  greeting: {
    ...typography.display,
    color: colors.text,
  },
  phase: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },

  tipCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  tipKicker: {
    ...typography.micro,
    color: colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tipTitle: { ...typography.title, color: colors.text, fontSize: 26 },
  tipBody: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  tipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  nextTipBtn: { paddingVertical: spacing.xs },
  nextTipLabel: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  tipCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },

  philosophy: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  philosophyKicker: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  philosophyBody: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    fontStyle: 'italic',
  },
});
