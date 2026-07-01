import React from 'react';
import { StyleSheet, View } from 'react-native';

import { palette } from '../../theme/designSystem';

export function MeshBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      {/* Electric-blue top edge glow */}
      <View style={styles.topGlow} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.void,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    width: '100%',
    height: 3,
    top: 0,
    left: 0,
    backgroundColor: 'rgba(34, 197, 94, 0.45)',
  },
});