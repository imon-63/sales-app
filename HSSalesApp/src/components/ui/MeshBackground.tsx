import React from 'react';
import { StyleSheet, View } from 'react-native';

import { palette } from '../../theme/designSystem';

export function MeshBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      {/* Top-left electric-blue nebula */}
      <View style={styles.nebulaTopLeft} pointerEvents="none" />
      {/* Bottom-right amber nebula */}
      <View style={styles.nebulaBottomRight} pointerEvents="none" />
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
  nebulaTopLeft: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -110,
    left: -90,
    backgroundColor: 'rgba(0, 168, 255, 0.06)',
  },
  nebulaBottomRight: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: -70,
    right: -70,
    backgroundColor: 'rgba(255, 179, 0, 0.05)',
  },
  topGlow: {
    position: 'absolute',
    width: '100%',
    height: 2,
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0, 168, 255, 0.45)',
  },
});
