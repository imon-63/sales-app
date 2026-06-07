import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { InventoryStockScreen } from '../screens/inventory/InventoryStockScreen';
import { ReceiveStockScreen } from '../screens/inventory/ReceiveStockScreen';
import { SaleDetails } from '../screens/sales/SaleDetails';
import { TransferStockScreen } from '../screens/inventory/TransferStockScreen';
import { LotReportScreen } from '../screens/inventory/LotReportScreen';
import { ProductDetailScreen } from '../screens/products/ProductDetailScreen';
import { PurchaseDetailScreen } from '../screens/purchases/PurchaseDetailScreen';
import { AdminNotificationsScreen } from '../screens/notifications/AdminNotificationsScreen';

import type { MainStackParamList } from './mainStackTypes';
import { WorkShell } from './WorkShell';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainAppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="Work" component={WorkShell} />
      <Stack.Screen name="StockRoom" component={InventoryStockScreen} />
      <Stack.Screen name="ReceiveStock" component={ReceiveStockScreen} />
      <Stack.Screen name="TransferStock" component={TransferStockScreen} />
      <Stack.Screen name="SaleDetails" component={SaleDetails} />
      <Stack.Screen name="LotReport" component={LotReportScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="PurchaseDetail" component={PurchaseDetailScreen} />
      <Stack.Screen name="Notifications" component={AdminNotificationsScreen} />
    </Stack.Navigator>
  );
}

