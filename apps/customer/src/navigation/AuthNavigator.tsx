import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PhoneInputScreen from '../screens/auth/PhoneInputScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import ABHALinkScreen from '../screens/auth/ABHALinkScreen';
import HealthProfileSetupScreen from '../screens/auth/HealthProfileSetupScreen';
import { colors } from '../theme/colors';

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneInput: undefined;
  OTP: { phone: string };
  ABHALink: undefined;
  HealthProfileSetup: undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

const headerOptions = {
  headerShown: true,
  headerTitle: '',
  headerBackTitleVisible: false,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.textPrimary,
};

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen
        name="PhoneInput"
        component={PhoneInputScreen}
        options={headerOptions}
      />
      <Stack.Screen
        name="OTP"
        component={OTPScreen}
        options={headerOptions}
      />
      <Stack.Screen
        name="ABHALink"
        component={ABHALinkScreen}
        options={headerOptions}
      />
      <Stack.Screen
        name="HealthProfileSetup"
        component={HealthProfileSetupScreen}
        options={{
          ...headerOptions,
          headerLeft: () => null, // Prevent going back from setup
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
