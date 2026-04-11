import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { playTts } from '../utils/audio';
import { renderMentionText } from '../utils/text';

type Message =
  | { id: string; type: 'system'; text: string; isError?: boolean; shake?: boolean }
  | { id: string; type: 'user'; en: string; shake?: boolean }
  | {
      id: string;
      type: 'npc';
      speaker: string;
      speakerName: string;
      speakerColor: string;
      en: string;
      zh?: string;
      voiceId?: string;
      shake?: boolean;
    };

export function ChatMessageBubble({
  message,
  userName,
}: {
  message: Message;
  userName?: string | null;
}) {
  const [playing, setPlaying] = useState(false);
  const shakeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message.type !== 'npc' || !message.shake) return;

    const animation = Animated.sequence([
      Animated.timing(shakeX, { toValue: -5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]);

    animation.start();
  }, [message, shakeX]);

  if (message.type === 'system') {
    return (
      <View style={[styles.systemMessage, message.isError ? styles.systemMessageError : null]}>
        <Text style={styles.systemText}>{message.text}</Text>
      </View>
    );
  }

  if (message.type === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userLabel}>你</Text>
          <Text style={styles.userText}>{message.en}</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.npcRow, { transform: [{ translateX: shakeX }] }]}>
      <View style={[styles.avatar, { backgroundColor: message.speakerColor }]}>
        <Text style={styles.avatarLabel}>{(message.speakerName || message.speaker)[0]}</Text>
      </View>
      <View style={styles.npcMeta}>
        <Text style={[styles.npcName, { color: message.speakerColor }]}>{message.speakerName}</Text>
        <View style={styles.npcBubble}>
          <Text style={styles.npcEn}>{renderMentionText(message.en, userName)}</Text>
          {!!message.zh && <Text style={styles.npcZh}>{renderMentionText(message.zh, userName)}</Text>}
          <Pressable
            onPress={async () => {
              if (playing) return;
              setPlaying(true);
              await playTts(message.en, message.voiceId, userName);
              setPlaying(false);
            }}
            hitSlop={8}
            style={styles.ttsButton}
          >
            <Text style={[styles.ttsLabel, playing ? styles.ttsLabelActive : null]}>🔊 重听</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  systemMessage: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  systemMessageError: {
    borderColor: colors.danger,
  },
  systemText: {
    color: colors.inkSoft,
    fontSize: 12,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  userBubble: {
    maxWidth: '78%',
    borderRadius: 20,
    padding: 14,
    backgroundColor: colors.ink,
    gap: 4,
  },
  userLabel: {
    color: '#D3C7FF',
    fontSize: 12,
    fontWeight: '700',
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
  },
  npcRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  npcMeta: {
    flex: 1,
    gap: 4,
  },
  npcName: {
    fontSize: 13,
    fontWeight: '700',
  },
  npcBubble: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: colors.paperStrong,
    borderColor: colors.line,
    borderWidth: 1,
    gap: 6,
  },
  npcEn: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 23,
  },
  npcZh: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  ttsButton: {
    alignSelf: 'flex-start',
  },
  ttsLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  ttsLabelActive: {
    color: colors.accent,
  },
});
