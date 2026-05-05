import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import React from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

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
  const dotOpacity = React.useRef(new Animated.Value(1)).current;
  const arrowNudge = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (unread > 0) {
      const dotLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, {
            toValue: 0.2,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dotOpacity, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      const arrowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(arrowNudge, {
            toValue: 1,
            duration: 420,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(arrowNudge, {
            toValue: 0,
            duration: 420,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      dotLoop.start();
      arrowLoop.start();
      return () => {
        dotLoop.stop();
        arrowLoop.stop();
      };
    }
    dotOpacity.stopAnimation();
    arrowNudge.stopAnimation();
    dotOpacity.setValue(1);
    arrowNudge.setValue(0);
  }, [unread, arrowNudge, dotOpacity]);

  const arrowStyle = {
    opacity: dotOpacity,
    transform: [
      {
        translateX: arrowNudge.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, -2],
        }),
      },
    ],
  };

  return (
    <View style={styles.iconWrap}>
      {unread > 0 ? (
        <Animated.View style={[styles.arrowCueWrap, arrowStyle]}>
          <Text style={styles.arrowCue}>➜</Text>
        </Animated.View>
      ) : null}
      <Text style={[styles.icon, { color }]} allowFontScaling={false}>
        {'\uD83D\uDD14'}
      </Text>
      {unread > 0 ? (
        <View style={styles.badge}>
          <Animated.View style={[styles.badgeBlinkDot, { opacity: dotOpacity }]} />
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
  badgeBlinkDot: {
    position: 'absolute',
    left: -4,
    top: -3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: palette.emerald,
    borderWidth: 1,
    borderColor: 'rgba(10, 15, 13, 0.7)',
  },
  arrowCueWrap: {
    position: 'absolute',
    left: -18,
    top: 5,
  },
  arrowCue: {
    color: palette.emerald,
    fontSize: 12,
    fontWeight: '900',
    textShadowColor: 'rgba(0,230,118,0.85)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },
});
