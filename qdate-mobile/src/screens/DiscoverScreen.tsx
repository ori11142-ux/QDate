import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { SwipeCard } from '../components/SwipeCard';
import { interestEmoji, interestLabel } from '../data/interests';
import {
  CalibrationMode,
  InterestCard,
  LookCard,
} from '../types';
import { colors, radius, spacing, typography } from '../theme';

export function DiscoverScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [mode, setMode] = useState<CalibrationMode>('interests');

  const [interestDeck, setInterestDeck] = useState<InterestCard[]>([]);
  const [lookDeck, setLookDeck] = useState<LookCard[]>([]);

  // Independent indices: progress in one deck doesn't touch the other.
  const [interestIndex, setInterestIndex] = useState(0);
  const [lookIndex, setLookIndex] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getInterestDeck(userId),
      api.getLookDeck(userId),
    ])
      .then(([interests, looks]) => {
        setInterestDeck(interests);
        setLookDeck(looks);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleSwipe(liked: boolean, cardId: string) {
    api
      .submitCalibrationSwipe(userId, {
        cardId,
        mode,
        liked,
        swipedAt: new Date().toISOString(),
      })
      .catch((e) => console.warn('calibration swipe failed', e));

    if (mode === 'interests') {
      setInterestIndex((i) => i + 1);
    } else {
      setLookIndex((i) => i + 1);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const deck = mode === 'interests' ? interestDeck : lookDeck;
  const currentIndex = mode === 'interests' ? interestIndex : lookIndex;
  const remaining = deck.length - currentIndex;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.h1}>Discover</Text>
        <Text style={styles.subtitle}>
          Helps the system learn your taste. Swiping here doesn&apos;t create matches.
        </Text>
      </View>

      <View style={styles.modeRow}>
        <ModeChip
          label="Interests & activities"
          active={mode === 'interests'}
          onPress={() => setMode('interests')}
        />
        <ModeChip
          label="Looks"
          active={mode === 'looks'}
          onPress={() => setMode('looks')}
        />
      </View>

      <Text style={styles.modeHint}>
        {mode === 'interests'
          ? 'Real people, no photos — swipe on their interests and bio.'
          : 'Real people, no names or bios — swipe on appearance only.'}
      </Text>

      <View style={styles.deckArea}>
        {remaining === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptySymbol}>✓</Text>
            <Text style={styles.emptyTitle}>You&apos;ve calibrated everything we have</Text>
            <Text style={styles.emptyBody}>
              The system has enough signal for now. New cards will appear as your taste evolves.
            </Text>
          </View>
        ) : (
          // Render up to 3 cards stacked, top one is interactive
          deck
            .slice(currentIndex, currentIndex + 3)
            .reverse()
            .map((card, reversedIdx, arr) => {
              const stackIndex = arr.length - 1 - reversedIdx;
              const isInterest = mode === 'interests';
              return (
                <SwipeCard
                  key={`${mode}-${card.id}`}
                  stackIndex={stackIndex}
                  onSwipeLeft={() => handleSwipe(false, card.id)}
                  onSwipeRight={() => handleSwipe(true, card.id)}
                >
                  {isInterest ? (
                    <InterestCardBody card={card as InterestCard} />
                  ) : (
                    <LookCardBody card={card as LookCard} />
                  )}
                </SwipeCard>
              );
            })
        )}
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => {
            const top = deck[currentIndex];
            if (top) handleSwipe(false, top.id);
          }}
          disabled={remaining === 0}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnNope,
            pressed && styles.pressed,
            remaining === 0 && styles.disabled,
          ]}
        >
          <Text style={[styles.actionLabel, { color: colors.danger }]}>×</Text>
        </Pressable>

        <Text style={styles.deckCount}>
          {remaining} / {deck.length}
        </Text>

        <Pressable
          onPress={() => {
            const top = deck[currentIndex];
            if (top) handleSwipe(true, top.id);
          }}
          disabled={remaining === 0}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnLike,
            pressed && styles.pressed,
            remaining === 0 && styles.disabled,
          ]}
        >
          <Text style={[styles.actionLabel, { color: colors.success }]}>♡</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ModeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function InterestCardBody({ card }: { card: InterestCard }) {
  const tags = card.tags ?? [];
  // Legacy static cards still carry an icon/label; new ones are real profiles.
  if (card.icon || card.label) {
    return (
      <View style={interestStyles.body}>
        <Text style={interestStyles.icon}>{card.icon}</Text>
        <Text style={interestStyles.label}>{card.label}</Text>
        <Text style={interestStyles.description}>{card.description}</Text>
      </View>
    );
  }
  return (
    <View style={interestStyles.profileBody}>
      <Text style={interestStyles.kicker}>Their interests</Text>
      <View style={interestStyles.chips}>
        {tags.map((tag) => (
          <View key={tag} style={interestStyles.chip}>
            <Text style={interestStyles.chipText} numberOfLines={1}>
              {interestEmoji(tag)} {interestLabel(tag)}
            </Text>
          </View>
        ))}
      </View>
      {card.bio ? (
        <Text style={interestStyles.bio} numberOfLines={3}>
          “{card.bio}”
        </Text>
      ) : null}
    </View>
  );
}

function LookCardBody({ card }: { card: LookCard }) {
  return (
    <View style={lookStyles.body}>
      <Image source={{ uri: card.photoUrl }} style={lookStyles.photo} />
      {card.name ? (
        <View style={lookStyles.caption}>
          <Text style={lookStyles.name}>
            {card.name}
            {card.age ? `, ${card.age}` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: { padding: spacing.lg, paddingBottom: 0 },
  h1: { ...typography.display, color: colors.text },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  modeRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: { ...typography.body, color: colors.text, fontWeight: '500' },
  chipLabelActive: { color: colors.textInverse },

  modeHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },

  deckArea: {
    flex: 1,
    margin: spacing.lg,
    position: 'relative',
  },
  emptyCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptySymbol: {
    fontSize: 56,
    color: colors.primary,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  actionBtnNope: { borderWidth: 1.5, borderColor: colors.danger },
  actionBtnLike: { borderWidth: 1.5, borderColor: colors.success },
  actionLabel: { fontSize: 32, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.3 },

  deckCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});

const interestStyles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
  },
  icon: { fontSize: 96 },
  label: {
    ...typography.display,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },

  profileBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
  },
  kicker: {
    ...typography.micro,
    color: colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { ...typography.caption, color: colors.text },
  bio: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: spacing.xs,
  },
});

const lookStyles = StyleSheet.create({
  body: { flex: 1 },
  photo: { flex: 1, width: '100%' },
  caption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: 'rgba(43, 45, 42, 0.7)',
  },
  name: {
    ...typography.title,
    color: colors.textInverse,
  },
});
