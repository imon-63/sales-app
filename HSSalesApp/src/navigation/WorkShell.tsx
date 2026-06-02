import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppSelector } from '../store/hooks';

import { AdminTabs } from './tabs/AdminTabs';
import { SalesTabs } from './tabs/SalesTabs';

export function WorkShell() {
  const role = useAppSelector((s) => s.auth.user?.role);

  return (
    <View style={styles.root}>
      {role === 'admin' ? <AdminTabs /> : <SalesTabs />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
});
