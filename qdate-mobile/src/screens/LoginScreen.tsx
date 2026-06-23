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
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, radius, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.includes('@') && password.length > 0 && !submitting;

  async function handleLogin() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // On success the auth context flips to a real user and RootNavigator
      // swaps to the Main stack automatically.
      await login(email.trim().toLowerCase(), password);
    } catch (e: any) {
      setError(e?.message ?? 'Could not log in. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
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
          <Text style={styles.h1}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to pick up where you left off.</Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError(null);
                }}
                placeholder="Your password"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                onSubmitEditing={handleLogin}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title="Log in"
            onPress={handleLogin}
            disabled={!canSubmit}
            loading={submitting}
          />
          <Pressable
            onPress={() => navigation.replace('Register', { authMethod: 'email' })}
            hitSlop={8}
            style={styles.signUpRow}
          >
            <Text style={styles.signUpText}>
              No account yet? <Text style={styles.signUpLink}>Create one</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  topBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  back: { fontSize: 32, color: colors.primary, lineHeight: 32, width: 32 },

  scroll: { padding: spacing.lg },
  h1: { ...typography.display, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },

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
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },

  footer: {
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  signUpRow: { alignItems: 'center' },
  signUpText: { ...typography.body, color: colors.textMuted },
  signUpLink: { color: colors.primary, fontWeight: '600' },
});
