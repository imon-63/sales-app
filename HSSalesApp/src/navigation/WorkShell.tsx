import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppMenuButton } from '../components/navigation/AppMenuButton';
import { useAppSelector } from '../store/hooks';

import { AdminTabs } from './tabs/AdminTabs';
import { SalesTabs } from './tabs/SalesTabs';
import { useAppSideMenu } from './useAppSideMenu';

export function WorkShell() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const { menuModal, openMenu } = useAppSideMenu();

  return (
    <View style={styles.root}>
      {role === 'admin' ? <AdminTabs /> : <SalesTabs />}
      <AppMenuButton onPress={openMenu} />
      {menuModal}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
});
