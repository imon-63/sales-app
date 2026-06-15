import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { AdminDashboardScreen } from '../../screens/dashboard/AdminDashboardScreen';
import { OperationsScreen } from '../../screens/operations/OperationsScreen';
import { SalesHubScreen } from '../../screens/sales/SalesHubScreen';
import { OrdersScreen } from '../../screens/orders/OrdersScreen';
import { ProductionScreen } from '../../screens/production/ProductionScreen';
import { useT } from '../../i18n/useT';
import { palette } from '../../theme/designSystem';
import { FloatingTabBar } from '../components/FloatingTabBar';

export type AdminTabParamList = {
  AdminHome: undefined;
  AdminOrders: undefined;
  AdminProduction: undefined;
  AdminLog: undefined;
  AdminOps: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

function AdminFloatingTabBar(props: BottomTabBarProps) {
  return <FloatingTabBar {...props} />;
}

export function AdminTabs() {
  const t = useT();

  return (
    <Tab.Navigator
      tabBar={AdminFloatingTabBar}
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
        name="AdminHome"
        component={AdminDashboardScreen}
        options={{
          title: t('tabs.admin.command'),
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="AdminOrders"
        component={OrdersScreen}
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>📋</Text>
          ),
        }}
      />
      <Tab.Screen
        name="AdminProduction"
        component={ProductionScreen}
        options={{
          title: 'Production',
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>⚙️</Text>
          ),
        }}
      />
      <Tab.Screen
        name="AdminLog"
        component={SalesHubScreen}
        options={{
          title: t('tabs.admin.log'),
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>💰</Text>
          ),
        }}
      />
      <Tab.Screen
        name="AdminOps"
        component={OperationsScreen}
        options={{
          title: t('tabs.admin.ops'),
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>🔧</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 20, fontWeight: '700' },
});
