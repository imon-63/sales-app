import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { hideToast } from '../../store/slices/uiSlice';
import { palette, radii, shadows } from '../../theme/designSystem';

export function Toast() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { visible, title, message, type } = useAppSelector((s) => s.ui.toast);

  const everShown = useRef(false);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  if (visible) {
    everShown.current = true;
  }

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: insets.top + 10,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide timer
      const timer = setTimeout(() => {
        handleDismiss();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      // Hide animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, insets.top]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dispatch(hideToast());
    });
  };

  if (!everShown.current) return null;

  const accentColor = 
    type === 'success' ? palette.emerald :
    type === 'error' ? palette.danger :
    palette.violet;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}>
      <View style={styles.content}>
        <View style={[styles.accent, { backgroundColor: accentColor }]} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 9999,
  },
  content: {
    backgroundColor: palette.paper,
    borderRadius: radii.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadows.card,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
  accent: {
    width: 6,
    height: '100%',
  },
  textContainer: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
  },
  title: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 2,
  },
  message: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
