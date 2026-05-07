import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '../theme/designSystem';
import { TAB_BAR_PILL_HEIGHT } from './tabBarMetrics';

import { MainMenuPanel } from './MainMenuPanel';
import type { MainStackParamList } from './mainStackTypes';

export function useAppSideMenu() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelWidth = useMemo(
    () => Math.min(310, Math.round(Dimensions.get('window').width * 0.64)),
    [],
  );
  const slideX = useRef(new Animated.Value(panelWidth)).current;

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
      toValue: panelWidth,
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
          <Pressable style={styles.dismissHit} onPress={close} accessibilityLabel="Close menu" />
          <Animated.View
            style={[
              styles.sheet,
              {
                width: panelWidth,
                marginTop: insets.top + 10,
                marginBottom: insets.bottom + TAB_BAR_PILL_HEIGHT + 212,
                marginRight: 10,
                transform: [{ translateX: slideX }],
              },
            ]}>
            <MainMenuPanel navigation={navigation} onClose={close} />
          </Animated.View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    flexDirection: 'row',
  },
  dismissHit: { flex: 1 },
  sheet: {
    alignSelf: 'flex-start',
    maxHeight: '88%',
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
    borderBottomLeftRadius: 30,
    borderTopLeftRadius: 32,
    overflow: 'hidden',
    backgroundColor: palette.paper,
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: -3, height: 8 },
    elevation: 10,
  },
});
