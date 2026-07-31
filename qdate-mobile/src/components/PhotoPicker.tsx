import React from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { colors, radius, spacing, typography } from '../theme';

// Photos are uploaded as base64 in a single request (4 at a time) through a 6 MB
// JSON limit, so full-res phone photos would fail. Downscale to this max edge and
// JPEG-compress first — plenty for display and for the face model (which works at
// 640px), while keeping each photo to a few hundred KB.
const MAX_UPLOAD_DIM = 1000;

interface Props {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
}

/**
 * A grid of up to `max` photo slots. Tapping an empty slot opens the image
 * library; tapping the × on a filled slot removes it. Stores each photo as a
 * base64 data URI (falling back to the asset uri).
 */
export function PhotoPicker({ photos, onChange, max = 4 }: Props) {
  async function pickInto(index: number) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo library access to add profile pictures.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1, // final compression is handled by the manipulator below
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    if (!asset.uri) return;

    // Downscale (only if larger — never upscale) + JPEG-compress before base64.
    let uri = asset.uri;
    try {
      const context = ImageManipulator.manipulate(asset.uri);
      if (asset.width && asset.width > MAX_UPLOAD_DIM) {
        context.resize({ width: MAX_UPLOAD_DIM }); // height auto → preserves the square crop
      }
      const rendered = await context.renderAsync();
      const out = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.6,
        base64: true,
      });
      if (out.base64) uri = `data:image/jpeg;base64,${out.base64}`;
      else if (out.uri) uri = out.uri;
    } catch {
      // Fall back to the original asset if manipulation is unavailable.
    }

    const next = [...photos];
    next[index] = uri;
    onChange(next.slice(0, max));
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  // Render `max` slots: filled ones first, then one "add" slot if there's room.
  const slots = Array.from({ length: max }, (_, i) => photos[i] ?? null);

  return (
    <View style={styles.grid}>
      {slots.map((photo, i) => (
        <View key={i} style={styles.slot}>
          {photo ? (
            <>
              <Image source={{ uri: photo }} style={styles.image} />
              <Pressable style={styles.removeBtn} onPress={() => remove(i)} hitSlop={6}>
                <Text style={styles.removeIcon}>×</Text>
              </Pressable>
              {i === 0 ? (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryText}>Main</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Pressable style={styles.addBtn} onPress={() => pickInto(i)}>
              <Text style={styles.addIcon}>+</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  image: { width: '100%', height: '100%' },
  addBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primaryLight,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  addIcon: { fontSize: 40, color: colors.primary, fontWeight: '300' },
  removeBtn: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(43, 45, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: { color: colors.textInverse, fontSize: 18, lineHeight: 20, fontWeight: '600' },
  primaryBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  primaryText: { ...typography.micro, color: colors.textInverse },
});
