import React from 'react';
import { Text, TextInput } from 'react-native';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Disable font scaling globally
if ((Text as any).defaultProps) {
  (Text as any).defaultProps.allowFontScaling = false;
} else {
  (Text as any).defaultProps = { allowFontScaling: false };
}
if ((TextInput as any).defaultProps) {
  (TextInput as any).defaultProps.allowFontScaling = false;
} else {
  (TextInput as any).defaultProps = { allowFontScaling: false };
}

import { LocaleBootstrap } from './src/i18n/LocaleBootstrap';
import { RootNavigator } from './src/navigation/RootNavigator';
import { store } from './src/store';
import { Toast } from './src/components/ui/Toast';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <SafeAreaProvider>
          <LocaleBootstrap />
          <RootNavigator />
          <Toast />
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
