import React, { useEffect, useRef } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const sparkleOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const sparkleScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.hero}>
          <Animated.Text
            style={[
              styles.sparkle,
              { opacity: sparkleOpacity, transform: [{ scale: sparkleScale }] },
            ]}
          >
            ✦
          </Animated.Text>
          <Text style={styles.brand}>QDate</Text>
          <Text style={styles.tagline}>Slow dating, by design</Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title="Create account"
            onPress={() => navigation.navigate('Register', { authMethod: 'email' })}
          />
          <PrimaryButton
            title="Log in"
            variant="outline"
            onPress={() => navigation.navigate('Login')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  sparkle: { fontSize: 80, color: colors.primary, marginBottom: spacing.md },
  brand: {
    ...typography.display,
    fontSize: 44,
    color: colors.text,
    letterSpacing: -0.5,
  },
  tagline: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  actions: { gap: spacing.md, marginBottom: spacing.lg },
});
