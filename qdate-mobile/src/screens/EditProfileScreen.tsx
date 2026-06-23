import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { PhotoPicker } from '../components/PhotoPicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { INTEREST_OPTIONS, INTEREST_PICK_COUNT } from '../data/interests';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Attraction, CommStyle, DatingIntent, Gender } from '../types';
import { colors, radius, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const BIO_MAX = 100;

const INTENT_OPTIONS: { value: DatingIntent; label: string }[] = [
  { value: 'long_term', label: 'Long-term' },
  { value: 'casual', label: 'Casual' },
  { value: 'explore', label: 'Explore' },
  { value: 'friendship', label: 'Friendship' },
];

const COMM_OPTIONS: { value: CommStyle; label: string }[] = [
  { value: 'texting_first', label: 'Texting first' },
  { value: 'voice_early', label: 'Voice early' },
  { value: 'meet_in_person', label: 'Meet in person' },
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

export function EditProfileScreen({ navigation }: Props) {
  const { user, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name ?? '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [photos, setPhotos] = useState<string[]>(user?.photos ?? []);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [gender, setGender] = useState<Gender | null>(user?.gender ?? null);
  const [attraction, setAttraction] = useState<Attraction | null>(
    user?.attraction ?? null
  );
  const [intent, setIntent] = useState<DatingIntent>(
    user?.profile.intent ?? 'long_term'
  );
  const [comm, setComm] = useState<CommStyle>(
    user?.profile.commStyle ?? 'texting_first'
  );
  const [intellect, setIntellect] = useState<number>(
    user?.profile.sharedIntellectImportance ?? 3
  );
  const [interests, setInterests] = useState<string[]>(user?.interestTags ?? []);
  const [saving, setSaving] = useState(false);

  function toggleInterest(tag: string) {
    setInterests((cur) => {
      if (cur.includes(tag)) return cur.filter((t) => t !== tag);
      if (cur.length >= INTEREST_PICK_COUNT) return cur; // cap at 5
      return [...cur, tag];
    });
  }

  const ageNum = Number(age);
  const ageValid = Number.isInteger(ageNum) && ageNum >= 18 && ageNum <= 99;
  const photosValid = photos.length === 4;
  const interestsValid = interests.length === INTEREST_PICK_COUNT;
  const canSave =
    name.trim().length > 0 && ageValid && photosValid && interestsValid && !saving;

  async function handleSave() {
    if (!canSave) {
      if (!ageValid) Alert.alert('Invalid age', 'Age must be between 18 and 99.');
      else if (!photosValid) Alert.alert('Photos required', 'Your profile needs exactly 4 photos.');
      else if (!interestsValid)
        Alert.alert('Interests required', `Pick exactly ${INTEREST_PICK_COUNT} interests.`);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        age: ageNum,
        photos,
        bio: bio.trim(),
        gender,
        attraction,
        interestTags: interests,
        profile: {
          intent,
          commStyle: comm,
          sharedIntellectImportance: intellect,
        },
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Something went wrong.');
      setSaving(false);
    }
  }

  return (
    <View style={styles.safe}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Edit profile</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={setAge}
          placeholder="18"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={2}
        />

        <Text style={styles.label}>Photos ({photos.length}/4)</Text>
        <Text style={styles.hint}>Your profile needs exactly 4 photos.</Text>
        <PhotoPicker photos={photos} onChange={setPhotos} max={4} />

        <Text style={styles.label}>Short bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
          placeholder="One line about you"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={BIO_MAX}
        />
        <Text style={styles.hint}>
          {bio.length}/{BIO_MAX}
        </Text>

        <Text style={styles.label}>Your gender</Text>
        <Chips
          options={GENDER_OPTIONS}
          selected={gender}
          onSelect={(v) => setGender(v)}
        />

        <Text style={styles.label}>Interested in</Text>
        <Chips
          options={ATTRACTION_OPTIONS}
          selected={attraction}
          onSelect={(v) => setAttraction(v)}
        />

        <Text style={styles.label}>Looking for</Text>
        <Chips options={INTENT_OPTIONS} selected={intent} onSelect={(v) => setIntent(v)} />

        <Text style={styles.label}>Communication style</Text>
        <Chips options={COMM_OPTIONS} selected={comm} onSelect={(v) => setComm(v)} />

        <Text style={styles.label}>How important is shared intellect?</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Pressable key={i} onPress={() => setIntellect(i)} hitSlop={8}>
              <Text style={[styles.star, i <= intellect && styles.starFilled]}>★</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>
          Interests ({interests.length}/{INTEREST_PICK_COUNT})
        </Text>
        <Text style={styles.hint}>
          Pick exactly {INTEREST_PICK_COUNT} — we use these to find better matches.
        </Text>
        <View style={styles.interestGrid}>
          {INTEREST_OPTIONS.map((opt) => {
            const active = interests.includes(opt.tag);
            return (
              <Pressable
                key={opt.tag}
                onPress={() => toggleInterest(opt.tag)}
                style={[styles.interestChip, active && styles.interestChipActive]}
              >
                <Text
                  style={[
                    styles.interestChipText,
                    active && styles.interestChipTextActive,
                  ]}
                >
                  {opt.emoji} {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <PrimaryButton
          title="Save changes"
          onPress={handleSave}
          disabled={!canSave}
          loading={saving}
        />
      </View>
    </View>
  );
}

function Chips<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { ...typography.body, color: colors.primary, fontWeight: '600', width: 48 },
  title: { ...typography.heading, color: colors.text },

  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },

  label: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  bioInput: { minHeight: 64, textAlignVertical: 'top' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body, color: colors.text },
  chipTextActive: { color: colors.textInverse },

  starRow: { flexDirection: 'row', gap: spacing.sm },
  star: { fontSize: 32, color: colors.border },
  starFilled: { color: colors.warning },

  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  interestChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  interestChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  interestChipText: { ...typography.body, color: colors.text },
  interestChipTextActive: { color: colors.primaryDark, fontWeight: '600' },

  footer: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
