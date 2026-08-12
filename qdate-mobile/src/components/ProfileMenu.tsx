// Slide-in side panel showing the signed-in user's own profile (photos,
// preferences, interests) plus edit / guidelines / sign-out actions.
import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { interestEmoji, interestLabel } from '../data/interests';
import { GuidelinesModal } from './CommunityGuidelines';
import { colors, radius, spacing, typography } from '../theme';

const INTENT_LABELS: Record<string, string> = {
  long_term: 'Long-term relationship',
  casual: 'Casual dating',
  explore: 'To explore',
  friendship: 'Friendship',
};

const COMM_LABELS: Record<string, string> = {
  texting_first: 'Texting first',
  voice_early: 'Voice calls early',
  meet_in_person: 'Meet in person',
};

const ATTRACTION_LABELS: Record<string, string> = {
  men: 'Men',
  women: 'Women',
  both: 'Everyone',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
}

// The side-drawer menu that shows the current user's profile and account actions.
export function ProfileMenu({ visible, onClose, onEditProfile }: Props) {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  if (!user) return null;

  const phaseLabel =
    user.currentPhase === 'phase_2' ? 'Phase 2 · Curated' : 'Phase 1 · Learning';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop touches inside the panel from closing the menu. */}
        <Pressable style={styles.panel} onPress={() => {}}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View style={styles.avatar}>
                {user.photoUrl ? (
                  <Image source={{ uri: user.photoUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitial}>
                    {user.name?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                )}
              </View>
              <Text style={styles.name}>
                {user.name}
                {user.age ? <Text style={styles.age}>, {user.age}</Text> : null}
              </Text>
              <Text style={styles.email}>{user.email}</Text>
              {user.bio ? <Text style={styles.bio}>“{user.bio}”</Text> : null}
              <View style={styles.phaseBadge}>
                <Text style={styles.phaseBadgeText}>{phaseLabel}</Text>
              </View>
            </View>

            {user.photos.length > 0 ? (
              <View style={styles.photoRow}>
                {user.photos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.photoThumb} />
                ))}
              </View>
            ) : null}

            <Detail label="Looking for" value={INTENT_LABELS[user.profile.intent] ?? '—'} />
            <Detail
              label="Communication"
              value={COMM_LABELS[user.profile.commStyle] ?? '—'}
            />
            <Detail
              label="Interested in"
              value={user.attraction ? ATTRACTION_LABELS[user.attraction] : '—'}
            />
            <Detail
              label="Shared intellect"
              value={'★'.repeat(user.profile.sharedIntellectImportance || 0) || '—'}
            />

            <Text style={styles.sectionLabel}>Interests</Text>
            {user.interestTags.length > 0 ? (
              <View style={styles.chips}>
                {user.interestTags.map((tag) => (
                  <View key={tag} style={styles.chip}>
                    <Text style={styles.chipText}>
                      {interestEmoji(tag)} {interestLabel(tag)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyInterests}>
                No interests yet — add some so we can match you better.
              </Text>
            )}
          </ScrollView>

          <View
            style={[
              styles.actions,
              // Clear the Android nav bar so "Sign out" isn't hidden behind the
              // phone's buttons. Floored because insets.bottom is often under-
              // reported (0) under Expo Go edge-to-edge.
              { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm },
            ]}
          >
            <Pressable style={styles.editBtn} onPress={onEditProfile}>
              <Text style={styles.editBtnText}>Edit profile</Text>
            </Pressable>
            <Pressable
              style={styles.guidelinesBtn}
              onPress={() => setGuidelinesOpen(true)}
              hitSlop={8}
            >
              <Text style={styles.guidelinesText}>Community Guidelines</Text>
            </Pressable>
            <Pressable style={styles.signOutBtn} onPress={signOut} hitSlop={8}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>

      <GuidelinesModal visible={guidelinesOpen} onClose={() => setGuidelinesOpen(false)} />
    </Modal>
  );
}

// Small label-on-left, value-on-right row used for the profile detail lines.
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    width: '84%',
    maxWidth: 360,
    backgroundColor: colors.background,
    flex: 1,
  },
  scroll: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  header: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { ...typography.display, color: colors.primary },
  name: { ...typography.title, color: colors.text },
  age: { ...typography.title, color: colors.textMuted, fontWeight: '400' },
  email: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  bio: {
    ...typography.body,
    color: colors.text,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  phaseBadge: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  phaseBadgeText: { ...typography.micro, color: colors.primaryDark, letterSpacing: 0.5 },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  detailLabel: { ...typography.caption, color: colors.textMuted },
  detailValue: { ...typography.body, color: colors.text, flexShrink: 1, textAlign: 'right' },

  sectionLabel: {
    ...typography.micro,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { ...typography.caption, color: colors.text },
  emptyInterests: { ...typography.caption, color: colors.textMuted, lineHeight: 20 },

  actions: {
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  editBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  editBtnText: { ...typography.heading, color: colors.textInverse },
  guidelinesBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  guidelinesText: { ...typography.body, color: colors.primaryDark, fontWeight: '600' },
  signOutBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  signOutText: { ...typography.body, color: colors.danger, fontWeight: '600' },
});
