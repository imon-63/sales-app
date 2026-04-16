import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { InventoryStockScreen } from '../screens/inventory/InventoryStockScreen';
import { ReceiveStockScreen } from '../screens/inventory/ReceiveStockScreen';
import { TransferStockScreen } from '../screens/inventory/TransferStockScreen';

import type { MainStackParamList } from './mainStackTypes';
import { WorkShell } from './WorkShell';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainAppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="Work" component={WorkShell} />
      <Stack.Screen name="StockRoom" component={InventoryStockScreen} />
      <Stack.Screen name="ReceiveStock" component={ReceiveStockScreen} />
      <Stack.Screen name="TransferStock" component={TransferStockScreen} />
    </Stack.Navigator>
  );
}
