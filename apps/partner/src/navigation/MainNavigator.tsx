import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes } from '../theme/typography';
import DashboardScreen from '../screens/DashboardScreen';
import WorkersScreen from '../screens/WorkersScreen';
import AddWorkerScreen from '../screens/AddWorkerScreen';
import WorkerDetailScreen from '../screens/WorkerDetailScreen';
import ContributeScreen from '../screens/ContributeScreen';
import PaymentConfirmScreen from '../screens/PaymentConfirmScreen';
import ReportsScreen from '../screens/ReportsScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type DashboardStackParamList = {
  DashboardHome: undefined;
  AddWorker: undefined;
  Contribute: { preselectedWorkerId?: string };
  PaymentConfirm: {
    workerIds: string[];
    amountPerWorkerPaise: number;
    sourceType: string;
    mode: string;
  };
};

export type WorkersStackParamList = {
  WorkersList: undefined;
  AddWorker: undefined;
  WorkerDetail: { workerId: string };
  Contribute: { preselectedWorkerId?: string };
  PaymentConfirm: {
    workerIds: string[];
    amountPerWorkerPaise: number;
    sourceType: string;
    mode: string;
  };
};

export type ContributeStackParamList = {
  ContributeHome: undefined;
  PaymentConfirm: {
    workerIds: string[];
    amountPerWorkerPaise: number;
    sourceType: string;
    mode: string;
  };
};

export type MainTabParamList = {
  DashboardTab: undefined;
  WorkersTab: undefined;
  ContributeTab: undefined;
  ReportsTab: undefined;
};

const DashboardStack = createStackNavigator<DashboardStackParamList>();
const WorkersStack = createStackNavigator<WorkersStackParamList>();
const ContributeStack = createStackNavigator<ContributeStackParamList>();

const screenOptions = {
  headerStyle: {
    backgroundColor: colors.background,
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: {
    fontWeight: '600' as const,
  },
  headerBackTitleVisible: false,
  cardStyle: {
    backgroundColor: colors.background,
  },
};

const DashboardStackNavigator: React.FC = () => (
  <DashboardStack.Navigator screenOptions={screenOptions}>
    <DashboardStack.Screen
      name="DashboardHome"
      component={DashboardScreen as React.ComponentType}
      options={{ headerShown: false }}
    />
    <DashboardStack.Screen
      name="AddWorker"
      component={AddWorkerScreen as React.ComponentType}
      options={{ title: 'Add Worker' }}
    />
    <DashboardStack.Screen
      name="Contribute"
      component={ContributeScreen as React.ComponentType}
      options={{ title: 'Contribute' }}
    />
    <DashboardStack.Screen
      name="PaymentConfirm"
      component={PaymentConfirmScreen as React.ComponentType}
      options={{ title: 'Confirm Payment' }}
    />
  </DashboardStack.Navigator>
);

const WorkersStackNavigator: React.FC = () => (
  <WorkersStack.Navigator screenOptions={screenOptions}>
    <WorkersStack.Screen
      name="WorkersList"
      component={WorkersScreen as React.ComponentType}
      options={{ headerShown: false }}
    />
    <WorkersStack.Screen
      name="AddWorker"
      component={AddWorkerScreen as React.ComponentType}
      options={{ title: 'Add Worker' }}
    />
    <WorkersStack.Screen
      name="WorkerDetail"
      component={WorkerDetailScreen as React.ComponentType}
      options={{ title: 'Worker Details' }}
    />
    <WorkersStack.Screen
      name="Contribute"
      component={ContributeScreen as React.ComponentType}
      options={{ title: 'Contribute' }}
    />
    <WorkersStack.Screen
      name="PaymentConfirm"
      component={PaymentConfirmScreen as React.ComponentType}
      options={{ title: 'Confirm Payment' }}
    />
  </WorkersStack.Navigator>
);

const ContributeStackNavigator: React.FC = () => (
  <ContributeStack.Navigator screenOptions={screenOptions}>
    <ContributeStack.Screen
      name="ContributeHome"
      component={ContributeScreen as React.ComponentType}
      options={{ headerShown: false }}
    />
    <ContributeStack.Screen
      name="PaymentConfirm"
      component={PaymentConfirmScreen as React.ComponentType}
      options={{ title: 'Confirm Payment' }}
    />
  </ContributeStack.Navigator>
);

const Tab = createBottomTabNavigator<MainTabParamList>();

const TabIcon: React.FC<{ label: string; focused: boolean }> = ({
  label,
  focused,
}) => (
  <Text
    style={[
      styles.tabIcon,
      { color: focused ? colors.primary : colors.textTertiary },
    ]}
  >
    {label}
  </Text>
);

const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: fontSizes.xs,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStackNavigator}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon label="D" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="WorkersTab"
        component={WorkersStackNavigator}
        options={{
          tabBarLabel: 'Workers',
          tabBarIcon: ({ focused }) => <TabIcon label="W" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ContributeTab"
        component={ContributeStackNavigator}
        options={{
          tabBarLabel: 'Contribute',
          tabBarIcon: ({ focused }) => <TabIcon label="C" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsScreen as React.ComponentType}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ focused }) => <TabIcon label="R" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
});

export default MainNavigator;
