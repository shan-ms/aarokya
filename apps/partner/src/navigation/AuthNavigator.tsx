import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { colors } from '../theme/colors';
import { PartnerType } from '../types';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PhoneInputScreen from '../screens/auth/PhoneInputScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import BusinessTypeScreen from '../screens/onboarding/BusinessTypeScreen';
import BusinessDetailsScreen from '../screens/onboarding/BusinessDetailsScreen';
import VerificationScreen from '../screens/onboarding/VerificationScreen';
import ContributionSchemeScreen from '../screens/onboarding/ContributionSchemeScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneInput: undefined;
  OTP: { phone: string; requestId: string };
  BusinessType: { phone: string };
  BusinessDetails: { phone: string; partnerType: string };
  Verification: {
    phone: string;
    partnerType: string;
    businessName: string;
    registrationNumber: string;
  };
  ContributionScheme: {
    phone: string;
    partnerType: PartnerType;
    businessName: string;
    registrationNumber: string;
  };
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
        component={WelcomeScreen as React.ComponentType}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PhoneInput"
        component={PhoneInputScreen as React.ComponentType}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="OTP"
        component={OTPScreen as React.ComponentType}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="BusinessType"
        component={BusinessTypeScreen as React.ComponentType}
        options={{ title: 'Organization Type', headerLeft: () => null }}
      />
      <Stack.Screen
        name="BusinessDetails"
        component={BusinessDetailsScreen as React.ComponentType}
        options={{ title: 'Business Details' }}
      />
      <Stack.Screen
        name="Verification"
        component={VerificationScreen as React.ComponentType}
        options={{ title: 'Verification' }}
      />
      <Stack.Screen
        name="ContributionScheme"
        component={ContributionSchemeScreen as React.ComponentType}
        options={{ title: 'Contribution Scheme' }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
