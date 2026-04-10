import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getUserStats } from '../api';
import { AppSurface } from '../components/AppSurface';
import { useAppState } from '../context/AppStateContext';
import { colors } from '../theme/colors';

export function ProfileScreen() {
  const { state } = useAppState();
  const [stats, setStats] = useState<{ chatCount: number; messageCount: number; savedCount: number } | null>(null);

  useEffect(() => {
    if (!state.userId) return;
    getUserStats(state.userId).then(setStats).catch(() => undefined);
  }, [state.userId]);

  return (
    <AppSurface>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>我的</Text>

        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{state.userName?.[0] || '?'}</Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.userName}>{state.userName || '未设置花名'}</Text>
            <Text style={styles.userId}>ID: {state.userId?.slice(0, 8) || '—'}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="参与群聊" value={stats?.chatCount || 0} />
          <StatCard label="发言次数" value={stats?.messageCount || 0} />
          <StatCard label="收藏表达" value={stats?.savedCount || 0} />
        </View>

        <View style={styles.settingsList}>
          <SettingRow label="花名" value={state.userName || '未设置'} />
          <SettingRow label="语音设置" />
          <SettingRow label="关于每日胡说" />
        </View>
      </ScrollView>
    </AppSurface>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value || '›'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 18,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.ink,
  },
  userCard: {
    backgroundColor: colors.paperStrong,
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: colors.accent,
    fontSize: 26,
    fontWeight: '800',
  },
  userMeta: {
    gap: 4,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  userId: {
    color: colors.inkSoft,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.paperStrong,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
  },
  statLabel: {
    color: colors.inkSoft,
    fontSize: 12,
  },
  settingsList: {
    backgroundColor: colors.paperStrong,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  settingRow: {
    minHeight: 56,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  settingLabel: {
    color: colors.ink,
    fontSize: 15,
  },
  settingValue: {
    color: colors.inkSoft,
  },
});
