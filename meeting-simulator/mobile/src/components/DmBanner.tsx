import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export function DmBanner({
  npcName,
  message,
  messageZh,
  onClose,
}: {
  npcName: string;
  message: string;
  messageZh?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <View style={styles.banner}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{npcName?.[0] || '?'}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{npcName} 给你发了私信</Text>
        <Text style={styles.message}>{message}</Text>
        {!!messageZh && <Text style={styles.messageZh}>{messageZh}</Text>}
      </View>
      <Pressable onPress={onClose} hitSlop={8}>
        <Text style={styles.close}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 18,
    left: 16,
    right: 16,
    zIndex: 10,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: colors.paperStrong,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  message: {
    fontSize: 14,
    color: colors.ink,
  },
  messageZh: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  close: {
    fontSize: 20,
    color: colors.inkSoft,
  },
});
