import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { ChatScreen } from '../screens/ChatScreen';
import { DailyFocusScreen } from '../screens/DailyFocusScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { colors, typography } from '../theme';

export type AuthMethod = 'email' | 'apple';

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
    photoUrl: string | null;
  };
  Main: undefined;
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

function MainTabs() {
  return (
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
  );
}

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
