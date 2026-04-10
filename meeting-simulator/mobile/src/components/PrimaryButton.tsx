import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' ? styles.secondary : styles.primary,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'secondary' ? styles.secondaryLabel : styles.primaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primary: {
    backgroundColor: colors.ink,
  },
  secondary: {
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  primaryLabel: {
    color: '#FFFFFF',
  },
  secondaryLabel: {
    color: colors.ink,
  },
});
