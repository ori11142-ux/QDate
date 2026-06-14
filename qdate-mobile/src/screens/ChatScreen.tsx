import React, { useEffect, useRef, useState, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { ChatMessage } from '../types';
import { colors, radius, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const MESSAGE_POLL_MS = 3000;
const STATUS_POLL_MS = 2500;

export function ChatScreen({ navigation, route }: Props) {
  const { matchId, conversationId, candidateName, candidatePhotoUrl } = route.params;
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [bothConnected, setBothConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Mark MY side of the pairing connected as soon as I open the chat.
  useEffect(() => {
    if (matchId) {
      api.connectMatch(matchId).catch((e) => console.warn('connect failed', e));
    }
  }, [matchId]);

  // Poll the pairing status until BOTH people have opened the chat. We only ever
  // latch to true, so the chat never flips back to "waiting" once it's open.
  useEffect(() => {
    if (!conversationId || bothConnected) {
      if (!conversationId) setChecking(false);
      return;
    }
    let active = true;
    const check = async () => {
      try {
        const s = await api.getConversationStatus(conversationId);
        if (!active) return;
        if (s.bothConnected) setBothConnected(true);
        setChecking(false);
      } catch (e) {
        if (active) setChecking(false);
      }
    };
    check();
    const id = setInterval(check, STATUS_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [conversationId, bothConnected]);

  const mapServerMessage = useCallback(
    (m: { id: string; senderId: string; text: string; sentAt: string }): ChatMessage => ({
      id: m.id,
      matchId: '',
      text: m.text,
      sentAt: m.sentAt,
      fromMe: m.senderId === userId,
    }),
    [userId]
  );

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const rows = await api.getConversationMessages(conversationId);
      setMessages(rows.map(mapServerMessage));
    } catch (e) {
      console.warn('load messages failed', e);
    }
  }, [conversationId, mapServerMessage]);

  // Once both have connected, load + poll messages.
  useEffect(() => {
    if (!bothConnected) return;
    let active = true;
    (async () => {
      await loadMessages();
    })();
    const id = setInterval(loadMessages, MESSAGE_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [bothConnected, loadMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || !conversationId || sending) return;

    setSending(true);
    setDraft('');

    const optimistic: ChatMessage = {
      id: `local_${Date.now()}`,
      matchId: '',
      text,
      sentAt: new Date().toISOString(),
      fromMe: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      await api.sendConversationMessage(conversationId, userId, text);
      await loadMessages();
    } catch (e) {
      console.warn('send failed', e);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  const headerInitial = (candidateName ?? '?')[0]?.toUpperCase() ?? '?';
  const headerSub = bothConnected ? 'Connected' : 'Waiting to connect…';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.avatar}>
          {candidatePhotoUrl ? (
            <Image source={{ uri: candidatePhotoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{headerInitial}</Text>
          )}
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>{candidateName ?? 'Your match'}</Text>
          <Text style={styles.headerSub}>{headerSub}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {checking ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !bothConnected ? (
          <View style={styles.center}>
            <View style={styles.waitCard}>
              <Text style={styles.waitSymbol}>⏳</Text>
              <Text style={styles.waitTitle}>Waiting for {candidateName ?? 'your match'}</Text>
              <Text style={styles.waitBody}>
                You&apos;ve opened the chat. It unlocks for both of you once{' '}
                {candidateName ?? 'they'} opens it too.
              </Text>
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messagesContent}
            renderItem={({ item }) => <Bubble message={item} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  You&apos;re both here. Say hello to {candidateName ?? 'your match'}.
                </Text>
              </View>
            }
          />
        )}

        {bothConnected && (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || sending}
              style={({ pressed }) => [
                styles.sendBtn,
                (!draft.trim() || sending) && styles.sendBtnDisabled,
                pressed && styles.sendBtnPressed,
              ]}
            >
              <Text style={styles.sendBtnLabel}>↑</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.fromMe;
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: {
    fontSize: 32,
    color: colors.primary,
    lineHeight: 32,
    marginRight: -spacing.xs,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { ...typography.heading, color: colors.primary },
  headerCenter: { flex: 1 },
  headerName: { ...typography.heading, color: colors.text },
  headerSub: { ...typography.caption, color: colors.textMuted },

  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  waitCard: { alignItems: 'center', gap: spacing.sm },
  waitSymbol: { fontSize: 48, marginBottom: spacing.sm },
  waitTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
  waitBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },

  messagesContent: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMine: { color: colors.textInverse },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 120,
    ...typography.body,
    color: colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendBtnPressed: { opacity: 0.85 },
  sendBtnLabel: { fontSize: 22, color: colors.textInverse, fontWeight: '600', lineHeight: 24 },
});
