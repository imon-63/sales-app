import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radii } from '../../theme/designSystem';

type Props = {
  onPress: () => void;
};

export function AppMenuButton({ onPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { top: insets.top + 6 },
        pressed ? styles.fabPressed : null,
      ]}>
      <Text style={styles.icon}>☰</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 14,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
  fabPressed: { opacity: 0.88 },
  icon: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: -1,
  },
});
