import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoPicker } from '../components/PhotoPicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, radius, spacing, typography } from '../theme';

const BIO_MAX = 100;

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation, route }: Props) {
  const { authMethod } = route.params;
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [bio, setBio] = useState('');

  const ageNumber = parseInt(age, 10);
  const fieldsValid =
    name.trim().length >= 2 &&
    email.includes('@') &&
    email.includes('.') &&
    password.length >= 8 &&
    !isNaN(ageNumber) &&
    ageNumber >= 18 &&
    ageNumber <= 99;
  const isValid = fieldsValid && photos.length === 4;

  function handleContinue() {
    if (!isValid) return;
    navigation.navigate('Onboarding', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      age: ageNumber,
      authMethod,
      photos,
      bio: bio.trim(),
    });
  }

  return (
    <View style={styles.safe}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.stepLabel}>Step 1 of 2</Text>
        <View style={styles.backSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.h1}>Create your account</Text>
          <Text style={styles.subtitle}>
            We&apos;ll use this to introduce you to your matches.
          </Text>

          {/* Photo picker — exactly 4 required */}
          <View style={styles.photoSection}>
            <Text style={styles.label}>Your photos</Text>
            <Text style={styles.hint}>Add 4 photos ({photos.length}/4)</Text>
            <PhotoPicker photos={photos} onChange={setPhotos} max={4} />
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Short bio</Text>
              <TextInput
                value={bio}
                onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
                placeholder="One line about you"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.bioInput]}
                multiline
                maxLength={BIO_MAX}
              />
              <Text style={styles.hint}>
                {bio.length}/{BIO_MAX}
              </Text>
            </View>
            <Field
              label="Your name"
              value={name}
              onChangeText={setName}
              placeholder="Ori"
              autoCapitalize="words"
            />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoCapitalize="none"
              hint="Minimum 8 characters"
            />
            <Field
              label="Your age"
              value={age}
              onChangeText={(v) => setAge(v.replace(/\D/g, ''))}
              placeholder="28"
              keyboardType="number-pad"
              maxLength={2}
              hint="Must be 18 or older"
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.progressRow}>
            <ProgressBar progress={0.5} />
          </View>
          <PrimaryButton title="Continue" onPress={handleContinue} disabled={!isValid} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  maxLength?: number;
  hint?: string;
  secureTextEntry?: boolean;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  maxLength,
  hint,
  secureTextEntry,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'space-between',
  },
  back: { fontSize: 32, color: colors.primary, lineHeight: 32, width: 32 },
  backSpacer: { width: 32 },
  stepLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  scroll: { padding: spacing.lg, paddingBottom: spacing.lg },

  h1: { ...typography.display, color: colors.text, marginBottom: spacing.sm },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },

  photoSection: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },

  form: { gap: spacing.lg },
  field: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted, letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  bioInput: { minHeight: 60, textAlignVertical: 'top' },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },

  footer: {
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  progressRow: { paddingHorizontal: spacing.xs },
});
