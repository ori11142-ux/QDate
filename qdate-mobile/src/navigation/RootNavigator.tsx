// Root navigation for the app: picks the logged-out flow (Welcome/Login/
// Register/Onboarding) vs. the signed-in app (bottom tabs + Chat/EditProfile),
// and shows a splash while we check for a saved session.
import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { ProfileMenu } from '../components/ProfileMenu';
import { ChatScreen } from '../screens/ChatScreen';
import { DailyFocusScreen } from '../screens/DailyFocusScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { colors, spacing, typography } from '../theme';

export type AuthMethod = 'email' | 'apple' | 'google';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: { authMethod: AuthMethod };
  Onboarding: {
    name: string;
    email: string;
    password: string;
    age: number;
    authMethod: AuthMethod;
    photos: string[];
    bio: string;
  };
  Main: undefined;
  EditProfile: undefined;
  Chat: {
    matchId: string;
    conversationId?: string;
    candidateName?: string;
    candidatePhotoUrl?: string;
  };
};

export type MainTabParamList = {
  Home: undefined;
  DailyFocus: undefined;
  Discover: undefined;
  Insights: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Top bar with the hamburger menu button and the QDate brand name.
function AppBar({ onMenuPress }: { onMenuPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[appBarStyles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable onPress={onMenuPress} hitSlop={12} style={appBarStyles.menuBtn}>
        <Text style={appBarStyles.menuIcon}>☰</Text>
      </Pressable>
      <Text style={appBarStyles.brand}>QDate</Text>
      <View style={appBarStyles.spacer} />
    </View>
  );
}

// The signed-in shell: the four bottom tabs plus the slide-in profile menu.
function MainTabs({ navigation }: NativeStackScreenProps<RootStackParamList, 'Main'>) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={appBarStyles.container}>
      <AppBar onMenuPress={() => setMenuOpen(true)} />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        }}
      >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>⌂</Text>
          ),
        }}
      />
      <Tab.Screen
        name="DailyFocus"
        component={DailyFocusScreen}
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>♡</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>⇆</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>◔</Text>
          ),
        }}
      />
      </Tab.Navigator>
      <ProfileMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onEditProfile={() => {
          setMenuOpen(false);
          navigation.navigate('EditProfile');
        }}
      />
    </View>
  );
}

const appBarStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuBtn: { width: 40, height: 32, justifyContent: 'center' },
  menuIcon: { fontSize: 24, color: colors.text },
  brand: { ...typography.heading, color: colors.primary, letterSpacing: 0.5 },
  spacer: { width: 40 },
});

// Branded loading screen shown while we read the saved user from storage.
function HydrationSplash() {
  return (
    <SafeAreaView style={splashStyles.safe}>
      <View style={splashStyles.body}>
        <Text style={splashStyles.sparkle}>✦</Text>
        <Text style={splashStyles.brand}>QDate</Text>
      </View>
    </SafeAreaView>
  );
}

const splashStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  sparkle: { fontSize: 64, color: colors.primary },
  brand: { ...typography.display, fontSize: 36, color: colors.text },
});

// Top-level navigator: shows the app if signed in, otherwise the auth screens.
export function RootNavigator() {
  const { user, isHydrating } = useAuth();

  if (isHydrating) {
    return <HydrationSplash />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
