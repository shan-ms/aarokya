import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppNavigator from './src/navigation/AppNavigator';
import { setAuthCallbacks } from './src/api/client';
import { useAuthStore } from './src/store/authStore';
import { colors } from './src/theme/colors';
import './src/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
});

const App: React.FC = () => {
  const updateToken = useAuthStore((state) => state.updateToken);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    setAuthCallbacks({
      onTokenRefreshed: (newToken: string) => {
        updateToken(newToken);
      },
      onAuthFailed: () => {
        logout();
      },
    });
  }, [updateToken, logout]);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
          <AppNavigator />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
};

export default App;
