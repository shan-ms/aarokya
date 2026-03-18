import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { colors } from '../theme/colors';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PhoneInputScreen from '../screens/auth/PhoneInputScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import BusinessTypeScreen from '../screens/onboarding/BusinessTypeScreen';
import BusinessDetailsScreen from '../screens/onboarding/BusinessDetailsScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneInput: undefined;
  OTP: { phone: string; requestId: string };
  BusinessType: { phone: string };
  BusinessDetails: { phone: string; partnerType: string };
};

const Stack = createStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerBackTitleVisible: false,
        cardStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PhoneInput"
        component={PhoneInputScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="OTP"
        component={OTPScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="BusinessType"
        component={BusinessTypeScreen}
        options={{ title: 'Organization Type', headerLeft: () => null }}
      />
      <Stack.Screen
        name="BusinessDetails"
        component={BusinessDetailsScreen}
        options={{ title: 'Business Details' }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
