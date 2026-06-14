import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, radius, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation, route }: Props) {
  const { authMethod } = route.params;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const ageNumber = parseInt(age, 10);
  const isValid =
    name.trim().length >= 2 &&
    email.includes('@') &&
    email.includes('.') &&
    password.length >= 8 &&
    !isNaN(ageNumber) &&
    ageNumber >= 18 &&
    ageNumber <= 99;

  async function handlePickPhoto() {
    // In Expo Go the photo-library permission is handled by Expo Go itself,
    // so this works without extra native config during development.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo library access to add a profile picture.'
      );
      return;
    }

    // mediaTypes defaults to images. quality + square crop keep the base64 small.
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset.base64) {
        setPhotoUrl(`data:image/jpeg;base64,${asset.base64}`);
      } else if (asset.uri) {
        setPhotoUrl(asset.uri);
      }
    }
  }

  function handleContinue() {
    if (!isValid) return;
    navigation.navigate('Onboarding', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      age: ageNumber,
      authMethod,
      photoUrl,
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
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

          {/* Photo picker */}
          <View style={styles.photoSection}>
            <Pressable onPress={handlePickPhoto} style={styles.photoCircle}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderIcon}>+</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={handlePickPhoto} hitSlop={8}>
              <Text style={styles.photoLabel}>
                {photoUrl ? 'Change photo' : 'Add a photo'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.form}>
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

        <View style={styles.footer}>
          <View style={styles.progressRow}>
            <ProgressBar progress={0.5} />
          </View>
          <PrimaryButton title="Continue" onPress={handleContinue} disabled={!isValid} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  photoCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 56,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceMuted,
  },
  photoPlaceholderIcon: {
    fontSize: 40,
    color: colors.primary,
    fontWeight: '300',
  },
  photoLabel: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
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
