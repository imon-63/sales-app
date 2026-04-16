import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

type Props = {
  size?: number;
  style?: ViewStyle;
};

export function HSLogo({ size = 96, style }: Props) {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size / 5),
        },
        style,
      ]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.48) }]}>
        HS
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  text: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 1,
  },
});

