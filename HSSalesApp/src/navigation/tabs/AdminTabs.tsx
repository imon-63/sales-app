import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AdminDashboardScreen } from '../../screens/dashboard/AdminDashboardScreen';
import { SalesCalendarScreen } from '../../screens/calendar/SalesCalendarScreen';
import { AdminNotificationsScreen } from '../../screens/notifications/AdminNotificationsScreen';
import { OperationsScreen } from '../../screens/operations/OperationsScreen';
import { useT } from '../../i18n/useT';
import { useAppSelector } from '../../store/hooks';
import { selectUnreadNotificationCount } from '../../store/slices/notificationsSlice';
import { palette } from '../../theme/designSystem';
import { FloatingTabBar } from '../components/FloatingTabBar';

export type AdminTabParamList = {
  AdminHome: undefined;
  AdminAlerts: undefined;
  AdminSales: undefined;
  AdminOps: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

function AdminFloatingTabBar(props: BottomTabBarProps) {
  return <FloatingTabBar {...props} />;
}

function AdminAlertsTabIcon({ color }: { color: string }) {
  const unread = useAppSelector(selectUnreadNotificationCount);
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.icon, { color }]} allowFontScaling={false}>
        {'\uD83D\uDD14'}
      </Text>
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </View>
  );
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
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>
              ⌁
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="AdminAlerts"
        component={AdminNotificationsScreen}
        options={{
          title: t('tabs.admin.signals'),
          tabBarIcon: ({ color }) => <AdminAlertsTabIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="AdminSales"
        component={SalesCalendarScreen}
        options={{
          title: t('tabs.admin.pulse'),
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>
              ◎
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="AdminOps"
        component={OperationsScreen}
        options={{
          title: t('tabs.admin.ops'),
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]} allowFontScaling={false}>
              ⎈
            </Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 20,
    fontWeight: '700',
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: palette.paper,
    fontSize: 10,
    fontWeight: '900',
  },
});
