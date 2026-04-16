import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { palette } from '../theme/designSystem';

import { MainMenuPanel } from './MainMenuPanel';
import type { MainStackParamList } from './mainStackTypes';

export function useAppSideMenu() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  const menuModal = useMemo(
    () => (
      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={close}
        presentationStyle="overFullScreen">
        <View style={styles.backdrop}>
          <Pressable style={styles.dismissHit} onPress={close} accessibilityLabel="Close menu" />
          <View style={styles.sheet}>
            <MainMenuPanel navigation={navigation} onClose={close} />
          </View>
        </View>
      </Modal>
    ),
    [open, close, navigation],
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
    backgroundColor: 'rgba(13, 27, 17, 0.35)',
    justifyContent: 'flex-end',
  },
  dismissHit: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    maxHeight: '92%',
    backgroundColor: palette.paper,
  },
});
