import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MainStackParamList } from '../../navigation/mainStackTypes';
import { palette, radii } from '../../theme/designSystem';

export function StackBackButton() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Work');
        }
      }}
      style={({ pressed }) => [
        styles.fab,
        { top: insets.top + 6, left: 64 },
        pressed ? styles.fabPressed : null,
      ]}>
      <Text style={styles.icon}>←</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
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
