import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { colors } from '../../src/theme/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: 'none',
        },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkSoft,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: '每日胡说',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="expressions"
        options={{
          title: '表达本',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📖</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
