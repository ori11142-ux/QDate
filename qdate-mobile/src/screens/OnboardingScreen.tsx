import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Attraction, CommStyle, DatingIntent, Gender } from '../types';
import { colors, radius, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const INTENT_OPTIONS: { value: DatingIntent; label: string }[] = [
  { value: 'long_term', label: 'Long-term Relationship' },
  { value: 'casual', label: 'Casual Dating' },
  { value: 'explore', label: 'To Explore' },
  { value: 'friendship', label: 'Friendship' },
];

const COMM_OPTIONS: { value: CommStyle; label: string }[] = [
  { value: 'texting_first', label: 'Texting First' },
  { value: 'voice_early', label: 'Voice Calls Early' },
  { value: 'meet_in_person', label: 'Meet in Person' },
];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
];

const ATTRACTION_OPTIONS: { value: Attraction; label: string }[] = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'both', label: 'Both' },
];

export function OnboardingScreen({ route }: Props) {
  const { name, email, password, age, authMethod, photoUrl } = route.params;
  const { register } = useAuth();

  const [intent, setIntent] = useState<DatingIntent | null>(null);
  const [intellect, setIntellect] = useState<number>(0);
  const [comm, setComm] = useState<CommStyle | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepsComplete = [intent, intellect > 0, comm, gender, attraction].filter(
    Boolean
  ).length;
  const ready = stepsComplete === 5;

  async function handleStart() {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      // Hits POST /api/auth/register. On success the auth context flips to a
      // real user and RootNavigator swaps to the Main stack automatically.
      await register({
        name,
        email,
        age,
        authMethod,
        password,
        photoUrl,
        gender,
        attraction,
        profile: {
          intent: intent!,
          sharedIntellectImportance: intellect,
          commStyle: comm!,
        },
      });
    } catch (e: any) {
      Alert.alert(
        'Could not create your account',
        e?.message ?? 'Something went wrong. Please try again.'
      );
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.stepLabel}>Step 2 of 2</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>What are you looking for?</Text>
        <Text style={styles.subtitle}>
          Welcome, {name}. Help us learn your dating intent.
        </Text>

        <Text style={styles.question}>What are you looking for?</Text>
        <View style={styles.radioGrid}>
          {INTENT_OPTIONS.map((opt) => (
            <Radio
              key={opt.value}
              label={opt.label}
              selected={intent === opt.value}
              onPress={() => setIntent(opt.value)}
            />
          ))}
        </View>

        <Text style={styles.question}>How important is shared intellect?</Text>
        <StarRow value={intellect} onChange={setIntellect} />

        <Text style={styles.question}>Preferred communication style?</Text>
        <View style={styles.commRow}>
          {COMM_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setComm(opt.value)}
              style={[styles.commChip, comm === opt.value && styles.commChipSelected]}
            >
              <Text
                style={[
                  styles.commChipLabel,
                  comm === opt.value && styles.commChipLabelSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.question}>Your gender?</Text>
        <View style={styles.commRow}>
          {GENDER_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setGender(opt.value)}
              style={[styles.commChip, gender === opt.value && styles.commChipSelected]}
            >
              <Text
                style={[
                  styles.commChipLabel,
                  gender === opt.value && styles.commChipLabelSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.question}>Interested in?</Text>
        <View style={styles.commRow}>
          {ATTRACTION_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setAttraction(opt.value)}
              style={[styles.commChip, attraction === opt.value && styles.commChipSelected]}
            >
              <Text
                style={[
                  styles.commChipLabel,
                  attraction === opt.value && styles.commChipLabelSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.progressRow}>
          <ProgressBar progress={1.0} />
        </View>
        <PrimaryButton
          title="Create account & start"
          onPress={handleStart}
          disabled={!ready}
          loading={submitting}
        />
      </View>
    </SafeAreaView>
  );
}

function Radio({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.radio}>
      <View style={[styles.radioDot, selected && styles.radioDotSelected]}>
        {selected && <View style={styles.radioDotInner} />}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
    </Pressable>
  );
}

function StarRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={8}>
          <Text style={[styles.star, i <= value && styles.starFilled]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  topBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  scroll: { padding: spacing.lg, paddingBottom: spacing.lg },

  h1: { ...typography.display, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },

  question: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },

  radioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  radio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: '47%',
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotSelected: { borderColor: colors.primary },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  radioLabel: { ...typography.body, color: colors.text, flexShrink: 1 },

  starRow: { flexDirection: 'row', gap: spacing.sm },
  star: { fontSize: 32, color: colors.border },
  starFilled: { color: colors.warning },

  commRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  commChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  commChipLabel: { ...typography.body, color: colors.text },
  commChipLabelSelected: { color: colors.textInverse },

  footer: {
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  progressRow: { paddingHorizontal: spacing.xs },
});
