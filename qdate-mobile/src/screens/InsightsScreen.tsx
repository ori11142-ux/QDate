import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { InsightsSummary } from '../types';
import { colors, radius, spacing, typography } from '../theme';

export function InsightsScreen() {
  const { user, signOut, togglePhase } = useAuth();
  const [insights, setInsights] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getInsights(user?.id ?? '')
      .then((d) => active && setInsights(d))
      .catch(() => active && setInsights(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.id]);

  function handleSignOutPress() {
    Alert.alert('Sign out?', "You'll need to register again to receive matches.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const nextPhaseLabel =
    user?.currentPhase === 'phase_1'
      ? 'Switch to Phase 2 (demo)'
      : 'Switch to Phase 1 (demo)';

  const o = insights?.matchOutcomes ?? {
    connected: 0,
    skipped: 0,
    expired: 0,
    pendingOrActive: 0,
  };
  const matchTotal = o.connected + o.skipped + o.expired + o.pendingOrActive;
  const pct = (n: number) => (matchTotal > 0 ? Math.round((100 * n) / matchTotal) : 0);

  const interestsPct =
    insights?.calibration.interests != null
      ? Math.round(insights.calibration.interests * 100)
      : null;
  const looksPct =
    insights?.calibration.looks != null
      ? Math.round(insights.calibration.looks * 100)
      : null;

  const avgReply =
    insights?.avgReplyTimeHours != null ? `${insights.avgReplyTimeHours.toFixed(1)}h` : '—';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Insights & Reflection</Text>
        <Text style={styles.subtitle}>
          {user
            ? `${user.name}, here's what the system is learning.`
            : 'How the system is learning your intent'}
        </Text>

        <Text style={styles.sectionTitle}>Your Activity</Text>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Match Outcomes</Text>
            {matchTotal === 0 ? (
              <Text style={styles.hint}>No matches yet.</Text>
            ) : (
              <View style={styles.barList}>
                <StatBar label="Connected" pct={pct(o.connected)} />
                <StatBar label="Skipped" pct={pct(o.skipped)} />
                <StatBar label="Expired" pct={pct(o.expired)} />
              </View>
            )}
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Messaging</Text>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{avgReply}</Text>
              <Text style={styles.statCaption}>avg reply time</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{insights?.messagesSentLast7Days ?? 0}</Text>
              <Text style={styles.statCaption}>messages, last 7d</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{insights?.totalMessages ?? 0}</Text>
              <Text style={styles.statCaption}>messages total</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Calibration Signal</Text>
        <View style={styles.fullCard}>
          {interestsPct == null && looksPct == null ? (
            <Text style={styles.hint}>
              Swipe in the Discover tab to build your calibration signal.
            </Text>
          ) : (
            <View style={styles.barList}>
              <StatBar label="Interests liked" pct={interestsPct ?? 0} />
              <StatBar label="Looks liked" pct={looksPct ?? 0} />
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Reflection Moments</Text>
        {insights && insights.reflections.length > 0 ? (
          <View style={styles.reflectionList}>
            {insights.reflections.map((m) => (
              <View key={m.matchId} style={styles.reflectionCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{m.name[0]}</Text>
                </View>
                <View style={styles.reflectionBody}>
                  <Text style={styles.reflectionName}>
                    {m.name}, {m.age}
                  </Text>
                  <Text style={styles.reflectionReason}>{m.reason}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.fullCard}>
            <Text style={styles.hint}>
              Reflections appear here when a match is skipped or expires.
            </Text>
          </View>
        )}

        <View style={styles.intentCard}>
          <Text style={styles.intentLabel}>Your Intent Score</Text>
          <Text style={styles.intentValue}>
            {(insights?.intentScore ?? 0).toFixed(1)}
            <Text style={styles.intentMax}> / 10</Text>
          </Text>
          <Text style={styles.intentCaption}>Updated from your real activity</Text>
        </View>

        <View style={styles.footerLinks}>
          <Pressable onPress={togglePhase} style={styles.linkBtn} hitSlop={8}>
            <Text style={styles.linkLabel}>{nextPhaseLabel}</Text>
          </Pressable>
          <Pressable onPress={handleSignOutPress} style={styles.linkBtn} hitSlop={8}>
            <Text style={styles.linkLabel}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBar({ label, pct }: { label: string; pct: number }) {
  return (
    <View style={styles.statBar}>
      <View style={styles.statBarHeader}>
        <Text style={styles.statBarLabel}>{label}</Text>
        <Text style={styles.statBarPct}>{pct}%</Text>
      </View>
      <View style={styles.statBarTrack}>
        <View style={[styles.statBarFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  center: { alignItems: 'center', justifyContent: 'center' },

  h1: { ...typography.display, color: colors.text },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },

  metricRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  fullCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  metricLabel: { ...typography.caption, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },

  barList: { gap: spacing.sm, marginTop: spacing.xs },
  statBar: { gap: 4 },
  statBarHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  statBarLabel: { ...typography.caption, color: colors.text },
  statBarPct: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  statBarTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  statBarFill: { height: 6, backgroundColor: colors.primary },

  statBlock: { marginTop: spacing.xs },
  statValue: { ...typography.title, color: colors.text },
  statCaption: { ...typography.caption, color: colors.textMuted },

  reflectionList: { gap: spacing.sm },
  reflectionCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.heading, color: colors.primary },
  reflectionBody: { flex: 1 },
  reflectionName: { ...typography.body, color: colors.text, fontWeight: '500' },
  reflectionReason: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  intentCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  intentLabel: { ...typography.caption, color: colors.textMuted },
  intentValue: { ...typography.display, fontSize: 48, color: colors.primary },
  intentMax: { ...typography.title, color: colors.textMuted },
  intentCaption: { ...typography.caption, color: colors.textMuted },

  footerLinks: { marginTop: spacing.xl, gap: spacing.sm, alignItems: 'center' },
  linkBtn: { paddingVertical: spacing.sm },
  linkLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
