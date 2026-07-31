import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import * as SystemUI from 'expo-system-ui';

import { AuthProvider } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

// Paint the NATIVE root-view background cream so nothing ever flashes black
// behind the React tree (e.g. the strip vacated as the keyboard dismisses under
// Android edge-to-edge). Works in Expo Go — the app.json backgroundColor keys
// only apply in a real build. Module scope = runs once at startup.
SystemUI.setBackgroundColorAsync(colors.background);

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background },
};

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="dark" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
