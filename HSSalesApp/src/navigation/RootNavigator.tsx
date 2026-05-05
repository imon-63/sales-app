import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { StatusBar } from 'react-native';

import { LoginScreen } from '../screens/LoginScreen';
import { palette } from '../theme/designSystem';
import { useAppSelector } from '../store/hooks';
import { MainGate } from './MainGate';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.emerald,
    background: palette.void,
    card: palette.paper,
    text: palette.text,
    border: palette.stroke,
    notification: palette.danger,
  },
};

export function RootNavigator() {
  const authed = useAppSelector((s) => Boolean(s.auth.token && s.auth.user));

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar barStyle="light-content" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}>
        {!authed ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainGate} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
