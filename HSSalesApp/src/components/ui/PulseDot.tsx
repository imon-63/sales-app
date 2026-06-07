import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export function PulseDot({ color = '#FF3B30' }: { color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 2.2,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [scale, opacity]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.pulse,
          {
            backgroundColor: color,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 14,
    height: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
  },
});
