import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radii } from '../theme/designSystem';
import { TAB_BAR_PILL_HEIGHT } from './tabBarMetrics';

import { MainMenuPanel } from './MainMenuPanel';
import type { MainStackParamList } from './mainStackTypes';

export function useAppSideMenu() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelWidth = useMemo(
    () => Math.min(360, Math.round(Dimensions.get('window').width * 0.82)),
    [],
  );
  const slideX = useRef(new Animated.Value(-panelWidth)).current;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      setVisible(true);
      Animated.timing(slideX, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(slideX, {
      toValue: -panelWidth,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [open, panelWidth, slideX]);

  const menuModal = useMemo(
    () => (
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        onRequestClose={close}
        presentationStyle="overFullScreen">
        <View style={styles.backdrop}>
          <Animated.View
            style={[
              styles.sheet,
              {
                width: panelWidth,
                marginTop: insets.top + 10,
                marginBottom: insets.bottom + TAB_BAR_PILL_HEIGHT + 8,
                transform: [{ translateX: slideX }],
              },
            ]}>
            <View pointerEvents="none" style={styles.sheetEdgeAccent} />
            <MainMenuPanel navigation={navigation} onClose={close} />
          </Animated.View>
          <Pressable style={styles.dismissHit} onPress={close} accessibilityLabel="Close menu" />
        </View>
      </Modal>
    ),
    [visible, close, navigation, panelWidth, slideX, insets.top, insets.bottom],
  );

  return {
    menuModal,
    openMenu: () => setOpen(true),
    closeMenu: close,
  };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 27, 17, 0.5)',
    flexDirection: 'row',
  },
  dismissHit: { flex: 1 },
  sheet: {
    alignSelf: 'flex-start',
    maxHeight: '92%',
    borderTopRightRadius: 32,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: radii.sm,
    borderTopLeftRadius: 0,
    overflow: 'hidden',
    backgroundColor: palette.paper,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 230, 118, 0.16)',
    shadowColor: '#001B10',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 6, height: 0 },
    elevation: 18,
  },
  sheetEdgeAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 6,
    width: 8,
    backgroundColor: 'rgba(0, 230, 118, 0.16)',
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 0,
  },
});
