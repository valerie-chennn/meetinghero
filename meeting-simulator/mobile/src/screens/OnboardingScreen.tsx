import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { initUser } from '../api';
import { AppSurface } from '../components/AppSurface';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppState } from '../context/AppStateContext';
import { colors } from '../theme/colors';
import { generateNickname } from '../utils/nameGenerator';

export function OnboardingScreen() {
  const { state, updateState } = useAppState();
  const [typed, setTyped] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setPlaceholder(generateNickname());
  }, []);

  async function handleStart() {
    if (isLoading) return;
    const finalName = typed.trim() || placeholder;
    if (!finalName || !state.userId) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      await initUser(state.userId, finalName);
      updateState({ userName: finalName });
      router.replace('/feed');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '提交失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppSurface>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>你的花名</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={typed}
              onChangeText={setTyped}
              placeholder={placeholder}
              placeholderTextColor={colors.inkSoft}
              autoCapitalize="words"
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={handleStart}
            />
            <Pressable onPress={() => setPlaceholder(generateNickname())} style={styles.diceButton}>
              <Text style={styles.diceText}>🎲</Text>
            </Pressable>
          </View>
          <PrimaryButton
            label={isLoading ? '创建中...' : '开始胡说'}
            onPress={handleStart}
            disabled={isLoading}
          />
          {isLoading && <ActivityIndicator style={styles.loader} color={colors.accent} />}
          {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
        </View>
      </View>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  content: {
    backgroundColor: colors.paperStrong,
    borderRadius: 28,
    padding: 24,
    gap: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
  },
  diceButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  diceText: {
    fontSize: 22,
  },
  loader: {
    marginTop: -6,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
});
