import React from 'react';
import { StyleSheet, View } from 'react-native';

import { palette } from '../../theme/designSystem';

/**
 * Global app backdrop without decorative circular blobs.
 */
export function MeshBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
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
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 28, 18, 0.42)',
  },
});
