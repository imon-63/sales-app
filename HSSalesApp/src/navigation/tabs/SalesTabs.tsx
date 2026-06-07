import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { SalesDashboardScreen } from '../../screens/dashboard/SalesDashboardScreen';
import { AccountScreen } from '../../screens/account/AccountScreen';
import { LogSaleScreen } from '../../screens/sales/LogSaleScreen';
import { ReceiveStockScreen } from '../../screens/inventory/ReceiveStockScreen';
import { OrdersScreen } from '../../screens/orders/OrdersScreen';
import { useT } from '../../i18n/useT';
import { palette } from '../../theme/designSystem';
import { FloatingTabBar } from '../components/FloatingTabBar';

export type SalesTabParamList = {
  SalesHome: undefined;
  SalesOrders: undefined;
  SalesLog: undefined;
  SalesPurchase: undefined;
  SalesAccount: undefined;
};

const Tab = createBottomTabNavigator<SalesTabParamList>();

function SalesFloatingTabBar(props: BottomTabBarProps) {
  return <FloatingTabBar {...props} />;
}

export function SalesTabs() {
  const t = useT();

  return (
    <Tab.Navigator
      tabBar={SalesFloatingTabBar}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: palette.emerald,
        tabBarInactiveTintColor: palette.tabBarInactive,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          height: 0,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}>
      <Tab.Screen
        name="SalesHome"
        component={SalesDashboardScreen}
        options={{
          title: t('tabs.sales.home'),
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="SalesOrders"
        component={OrdersScreen}
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>📋</Text>
          ),
        }}
      />
      <Tab.Screen
        name="SalesLog"
        component={LogSaleScreen}
        options={{
          title: t('tabs.sales.log'),
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>💰</Text>
          ),
        }}
      />
      <Tab.Screen
        name="SalesPurchase"
        component={ReceiveStockScreen}
        options={{
          title: t('tabs.sales.purchase'),
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>📦</Text>
          ),
        }}
      />
      <Tab.Screen
        name="SalesAccount"
        component={AccountScreen}
        options={{
          title: t('tabs.sales.you'),
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 20, fontWeight: '700' },
});
