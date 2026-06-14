import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { CooldownModal } from '../components/CooldownModal';
import { CountdownTimer } from '../components/CountdownTimer';
import { MatchRevealCard } from '../components/MatchRevealCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import {
  MainTabParamList,
  RootStackParamList,
} from '../navigation/RootNavigator';
import { Match, Phase } from '../types';
import { colors, radius, spacing, typography } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'DailyFocus'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Stage = 'loading' | 'mystery' | 'revealed' | 'closed' | 'unavailable';

const PHASE_CONFIG: Record<
  Phase,
  {
    headerTitle: string;
    headerSubtitle: (match: Match) => string;
    showLearningProgress: boolean;
    revealLabel: string;
    revealSubtitle: string;
    confirmSkip: boolean;
    closedTitle: string;
    closedBody: string;
    closedSymbol: string;
  }
> = {
  phase_1: {
    headerTitle: 'The Daily Focus',
    headerSubtitle: (m) =>
      `Day ${m.dayInLearningPeriod ?? 0} of ${m.totalLearningDays ?? 14} · Learning Period`,
    showLearningProgress: true,
    revealLabel: 'Reveal Today\'s Match',
    revealSubtitle: 'Tap to discover who you\'ve been matched with',
    confirmSkip: false,
    closedTitle: 'Next match arrives tomorrow',
    closedBody:
      'Your feedback helps the system learn. Take some time to reflect before the next reveal.',
    closedSymbol: '◔',
  },
  phase_2: {
    headerTitle: 'This Week\'s Match',
    headerSubtitle: () => 'Curated · High Intentionality',
    showLearningProgress: false,
    revealLabel: 'Reveal This Week\'s Match',
    revealSubtitle: 'A high-intentionality pairing. Take your time.',
    confirmSkip: true,
    closedTitle: 'Back to a daily match',
    closedBody:
      'You skipped this week\'s curated match. A regular daily match arrives tomorrow — and the next curated one comes in a week.',
    closedSymbol: '⏳',
  },
};

export function DailyFocusScreen({ navigation }: Props) {
  const { user } = useAuth();
  const phase: Phase = user?.currentPhase ?? 'phase_1';
  const userId = user?.id ?? '';
  const cfg = PHASE_CONFIG[phase];

  const [stage, setStage] = useState<Stage>('loading');
  const [match, setMatch] = useState<Match | null>(null);
  const [nextMatchAt, setNextMatchAt] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [cooldownModalOpen, setCooldownModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const profileOpacity = useRef(new Animated.Value(0)).current;
  const profileTranslate = useRef(new Animated.Value(20)).current;

  const loadMatch = useCallback(() => {
    setStage('loading');
    setMatch(null);
    setNextMatchAt(null);
    setLoadError(null);

    const fetcher =
      phase === 'phase_2'
        ? api.getWeeklyCuratedMatch(userId)
        : api.generateDailyMatch(userId);

    return fetcher
      .then((m) => {
        setMatch(m);
        if (m.status === 'connected' || m.status === 'active') {
          // Already revealed (or chat already opened) — show the profile
          // directly instead of replaying the mystery reveal.
          setStage('revealed');
          profileOpacity.setValue(1);
          profileTranslate.setValue(0);
        } else {
          setStage('mystery');
          profileOpacity.setValue(0);
          profileTranslate.setValue(20);
        }
      })
      .catch((e) => {
        // Don't leave the screen spinning forever — show the reason + a retry.
        setLoadError(String(e?.message ?? e));
        setStage('unavailable');
      });
  }, [phase, userId, profileOpacity, profileTranslate]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  function handleRevealComplete() {
    setStage('revealed');
    // Tell the backend the match was revealed (status → active). Fire-and-forget.
    if (match) {
      api.revealMatch(match.matchId).catch((e) => console.warn('reveal failed', e));
    }
    Animated.parallel([
      Animated.timing(profileOpacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(profileTranslate, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function handleOpenChat() {
    if (!match) return;
    navigation.navigate('Chat', {
      matchId: match.matchId,
      conversationId: match.conversationId,
      candidateName: match.candidateName,
      candidatePhotoUrl: match.candidatePhotoUrl,
    });
  }

  function handleSkipPressed() {
    if (cfg.confirmSkip) {
      setCooldownModalOpen(true);
    } else {
      void commitSkip();
    }
  }

  async function commitSkip() {
    if (!match) return;
    setCooldownModalOpen(false);
    setActionInFlight(true);
    try {
      // Close this match on the backend (status → skipped) so the next
      // generate picks a new candidate.
      await api.skipMatch(match.matchId);
      // Both phases: next match arrives in 24h after a skip.
      // (Phase 2 specifically: skipping = back to daily for the next cycle.)
      const next = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      setNextMatchAt(next);
      setStage('closed');
    } catch (e) {
      Alert.alert('Could not skip', String(e));
    } finally {
      setActionInFlight(false);
    }
  }

  if (stage === 'loading') {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (stage === 'unavailable' || !match) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <View style={styles.unavailableCard}>
          <Text style={styles.unavailableSymbol}>◔</Text>
          <Text style={styles.unavailableTitle}>No match right now</Text>
          <Text style={styles.unavailableBody}>
            {loadError ?? 'We couldn\'t load a match. Please try again.'}
          </Text>
          <Pressable onPress={() => loadMatch()} style={styles.retryBtn}>
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const learningProgress =
    cfg.showLearningProgress && match.dayInLearningPeriod && match.totalLearningDays
      ? match.dayInLearningPeriod / match.totalLearningDays
      : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.h1}>{cfg.headerTitle}</Text>
            {phase === 'phase_2' && (
              <View style={styles.phaseBadge}>
                <Text style={styles.phaseBadgeLabel}>Phase 2</Text>
              </View>
            )}
          </View>
          <Text style={styles.subtitle}>{cfg.headerSubtitle(match)}</Text>
          {cfg.showLearningProgress && (
            <View style={styles.progressBar}>
              <ProgressBar progress={learningProgress} />
            </View>
          )}
        </View>

        {stage === 'mystery' && (
          <View style={styles.body}>
            <MatchRevealCard
              onRevealComplete={handleRevealComplete}
              buttonLabel={cfg.revealLabel}
              subtitle={cfg.revealSubtitle}
            />
          </View>
        )}

        {stage === 'revealed' && (
          <Animated.View
            style={[
              styles.body,
              {
                opacity: profileOpacity,
                transform: [{ translateY: profileTranslate }],
              },
            ]}
          >
            <View style={styles.card}>
              <View style={styles.photo}>
                {match.candidatePhotoUrl ? (
                  <Image
                    source={{ uri: match.candidatePhotoUrl }}
                    style={styles.photoImage}
                  />
                ) : (
                  <Text style={styles.photoInitial}>{match.candidateName[0]}</Text>
                )}
                <View style={styles.timerOverlay}>
                  <CountdownTimer expiresAt={match.expiresAt} compact />
                </View>
                {phase === 'phase_2' && match.isIntentionalPairing && (
                  <View style={styles.intentBadge}>
                    <Text style={styles.intentBadgeText}>✦ Curated</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.name}>
                  {match.candidateName}, {match.candidateAge}
                </Text>
                <Text style={styles.bio}>{match.candidateBio}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <PrimaryButton
                title="Open Chat"
                onPress={handleOpenChat}
                style={styles.actionBtn}
              />
              <PrimaryButton
                title="Skip"
                variant="outline"
                onPress={handleSkipPressed}
                loading={actionInFlight}
                style={styles.actionBtn}
              />
            </View>
          </Animated.View>
        )}

        {stage === 'closed' && (
          <View style={styles.body}>
            <View style={styles.closedCard}>
              <Text style={styles.closedSymbol}>{cfg.closedSymbol}</Text>
              <Text style={styles.closedTitle}>{cfg.closedTitle}</Text>
              <Text style={styles.closedBody}>{cfg.closedBody}</Text>

              {nextMatchAt && (
                <View style={styles.countdownBlock}>
                  <Text style={styles.countdownLabel}>Next match in</Text>
                  <CountdownTimer expiresAt={nextMatchAt} />
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <CooldownModal
        visible={cooldownModalOpen}
        onCancel={() => setCooldownModalOpen(false)}
        onConfirm={commitSkip}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  unavailableCard: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  unavailableSymbol: { fontSize: 48, color: colors.primaryLight, marginBottom: spacing.sm },
  unavailableTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
  unavailableBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  retryLabel: { ...typography.body, color: colors.textInverse, fontWeight: '600' },

  header: { marginBottom: spacing.lg },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  h1: { ...typography.display, color: colors.text, flex: 1 },
  phaseBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  phaseBadgeLabel: {
    ...typography.micro,
    color: colors.textInverse,
    letterSpacing: 1,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  progressBar: { marginTop: spacing.md },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    width: '100%',
  },
  photo: {
    backgroundColor: colors.surfaceMuted,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitial: {
    fontSize: 96,
    color: colors.primaryLight,
    fontWeight: '300',
  },
  photoImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  timerOverlay: { position: 'absolute', top: spacing.md, right: spacing.md },
  intentBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  intentBadgeText: { ...typography.micro, color: colors.textInverse },

  cardBody: { padding: spacing.lg, gap: spacing.sm },
  name: { ...typography.display, color: colors.text },
  bio: { ...typography.body, color: colors.textMuted },

  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  actionBtn: { flex: 1 },

  closedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  closedSymbol: { fontSize: 56, color: colors.primary },
  closedTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
  closedBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  countdownBlock: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    width: '100%',
  },
  countdownLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
