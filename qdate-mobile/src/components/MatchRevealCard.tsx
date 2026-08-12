// Mystery "reveal" card for the daily match: an idle glow, then a tap triggers a
// shake -> flash -> sparkle-burst animation before the matched profile is shown.
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface Props {
  onRevealComplete: () => void;
  buttonLabel?: string;
  subtitle?: string;
}

type Phase = 'idle' | 'animating';

const PARTICLE_COUNT = 10;
const PARTICLE_DISTANCE = 140;

// Animated card the user taps to dramatically reveal today's one match.
export function MatchRevealCard({
  onRevealComplete,
  buttonLabel = 'Reveal Today\'s Match',
  subtitle = 'Tap to discover who you\'ve been matched with',
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');

  // Idle: gentle pulsing glow underneath the card.
  const idlePulse = useRef(new Animated.Value(0)).current;

  // Animation: shake, glow ramp, burst flash, particles, fade out.
  const shake = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const particleAnim = useRef(new Animated.Value(0)).current;

  // Set of fixed angles for sparkle particles, spread evenly around the card.
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      return {
        cos: Math.cos(angle),
        sin: Math.sin(angle),
        delay: Math.random() * 100,
      };
    })
  ).current;

  // Idle pulsing — runs forever until the user taps reveal.
  useEffect(() => {
    if (phase !== 'idle') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idlePulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(idlePulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, idlePulse]);

  function handleReveal() {
    setPhase('animating');

    // Anticipation: 1.4s of shaking + glow build-up
    const shakeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      ]),
      { iterations: 13 }
    );

    Animated.parallel([
      shakeLoop,
      Animated.timing(glow, {
        toValue: 1,
        duration: 1400,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Burst phase: card scales up briefly, flash erupts, particles fly out, then card fades.
      Animated.parallel([
        Animated.sequence([
          Animated.timing(cardScale, {
            toValue: 1.18,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(cardScale, {
            toValue: 0.6,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(flash, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(flash, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(cardOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(particleAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onRevealComplete();
      });
    });
  }

  const shakeTranslate = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-6, 0, 6],
  });

  const idleGlowScale = idlePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.1],
  });
  const idleGlowOpacity = idlePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.55],
  });

  const burstGlowScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });
  const burstGlowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.9],
  });

  return (
    <View style={styles.container}>
      <View style={styles.stage}>
        {/* Idle gentle glow */}
        {phase === 'idle' && (
          <Animated.View
            style={[
              styles.glow,
              {
                transform: [{ scale: idleGlowScale }],
                opacity: idleGlowOpacity,
              },
            ]}
          />
        )}

        {/* Burst glow */}
        {phase === 'animating' && (
          <Animated.View
            style={[
              styles.glow,
              styles.burstGlow,
              {
                transform: [{ scale: burstGlowScale }],
                opacity: burstGlowOpacity,
              },
            ]}
          />
        )}

        {/* Particles */}
        {phase === 'animating' &&
          particles.map((p, i) => {
            const tx = particleAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, p.cos * PARTICLE_DISTANCE],
            });
            const ty = particleAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, p.sin * PARTICLE_DISTANCE],
            });
            const opacity = particleAnim.interpolate({
              inputRange: [0, 0.15, 0.7, 1],
              outputRange: [0, 1, 1, 0],
            });
            const scale = particleAnim.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [0.5, 1.2, 0.4],
            });
            return (
              <Animated.Text
                key={i}
                style={[
                  styles.particle,
                  {
                    opacity,
                    transform: [
                      { translateX: tx },
                      { translateY: ty },
                      { scale },
                    ],
                  },
                ]}
              >
                ✦
              </Animated.Text>
            );
          })}

        {/* Mystery card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [
                { translateX: shakeTranslate },
                { scale: cardScale },
              ],
            },
          ]}
        >
          <Text style={styles.cardSparkleTop}>✧</Text>
          <Text style={styles.cardSymbol}>✦</Text>
          <Text style={styles.cardLabel}>Your Match Today</Text>
          <Text style={styles.cardSparkleBottom}>✧</Text>
        </Animated.View>

        {/* Flash overlay */}
        {phase === 'animating' && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.flash,
              {
                opacity: flash.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.85],
                }),
              },
            ]}
          />
        )}
      </View>

      {phase === 'idle' && (
        <>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Pressable
            onPress={handleReveal}
            style={({ pressed }) => [
              styles.revealBtn,
              pressed && styles.revealBtnPressed,
            ]}
          >
            <Text style={styles.revealBtnLabel}>{buttonLabel}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const CARD_W = 240;
const CARD_H = 320;
const GLOW_SIZE = 280;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  stage: {
    width: CARD_W + spacing.xl * 2,
    height: CARD_H + spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: colors.primaryLight,
  },
  burstGlow: {
    backgroundColor: colors.primary,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardSymbol: {
    fontSize: 96,
    color: colors.primary,
    marginVertical: spacing.md,
  },
  cardLabel: {
    ...typography.heading,
    color: colors.text,
    letterSpacing: 0.5,
  },
  cardSparkleTop: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    fontSize: 18,
    color: colors.primaryLight,
  },
  cardSparkleBottom: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    fontSize: 18,
    color: colors.primaryLight,
  },
  particle: {
    position: 'absolute',
    fontSize: 22,
    color: colors.primary,
  },
  flash: {
    position: 'absolute',
    width: '120%',
    height: '120%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  revealBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  revealBtnPressed: {
    opacity: 0.85,
  },
  revealBtnLabel: {
    ...typography.heading,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
});
