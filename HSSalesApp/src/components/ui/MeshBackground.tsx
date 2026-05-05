import React from 'react';
import { StyleSheet, View } from 'react-native';

import { palette } from '../../theme/designSystem';

/**
 * Dark-mode backdrop: deep forest base + glowing green blobs.
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
    backgroundColor: 'rgba(0, 230, 118, 0.14)',
    opacity: 0.92,
  },
  blob2: {
    width: 380,
    height: 380,
    bottom: -120,
    left: -130,
    backgroundColor: 'rgba(0, 200, 83, 0.11)',
    opacity: 0.88,
  },
  blob3: {
    width: 280,
    height: 280,
    top: '36%',
    left: '12%',
    backgroundColor: 'rgba(105, 240, 174, 0.08)',
    opacity: 0.65,
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 28, 18, 0.42)',
  },
});
