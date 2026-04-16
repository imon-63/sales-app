import React from 'react';
import { StyleSheet, View } from 'react-native';

import { palette } from '../../theme/designSystem';

/**
 * Soft organic backdrop: cream base + mint / lime / butter blobs (reference UI).
 */
export function MeshBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />
      <View style={[styles.blob, styles.blob3]} />
      <View style={styles.wash} />
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
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blob1: {
    width: 420,
    height: 420,
    top: -150,
    right: -100,
    backgroundColor: palette.emeraldLight,
    opacity: 0.55,
  },
  blob2: {
    width: 380,
    height: 380,
    bottom: -120,
    left: -130,
    backgroundColor: palette.night,
    opacity: 0.85,
  },
  blob3: {
    width: 280,
    height: 280,
    top: '36%',
    left: '12%',
    backgroundColor: palette.amber,
    opacity: 0.35,
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(243, 244, 237, 0.72)',
  },
});
