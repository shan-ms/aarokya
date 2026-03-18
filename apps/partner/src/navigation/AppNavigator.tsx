import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme/colors';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const partner = useAuthStore((state) => state.partner);
  const isNewPartner = useAuthStore((state) => state.isNewPartner);

  const showMain = isAuthenticated && partner && !isNewPartner;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {showMain ? (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                headerShown: true,
                headerStyle: {
                  backgroundColor: colors.background,
                  elevation: 0,
                  shadowOpacity: 0,
                },
                headerTintColor: colors.textPrimary,
                headerTitle: 'Profile',
                headerBackTitleVisible: false,
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
