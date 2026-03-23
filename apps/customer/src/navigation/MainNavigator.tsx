import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import HomeScreen from '../screens/HomeScreen';
import LinkABHAScreen from '../screens/LinkABHAScreen';
import HSADetailScreen from '../screens/HSADetailScreen';
import ContributeScreen from '../screens/ContributeScreen';
import CheckInScreen from '../screens/CheckInScreen';
import RecordsVaultScreen from '../screens/RecordsVaultScreen';
import PrivacyCenterScreen from '../screens/PrivacyCenterScreen';
import FamilyProfilesScreen from '../screens/FamilyProfilesScreen';
import InsuranceScreen from '../screens/InsuranceScreen';
import ClaimsScreen from '../screens/ClaimsScreen';
import HealthProfileScreen from '../screens/HealthProfileScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export type HomeStackParamList = {
  HomeMain: undefined;
  LinkABHA: undefined;
  HSADetail: undefined;
  Contribute: undefined;
  CheckIn: undefined;
  RecordsVault: undefined;
  PrivacyCenter: undefined;
  FamilyProfiles: undefined;
};

const HomeStack = createStackNavigator<HomeStackParamList>();

const stackHeaderOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.textPrimary,
  headerBackTitleVisible: false,
};

const HomeStackNavigator: React.FC = () => (
  <HomeStack.Navigator screenOptions={stackHeaderOptions}>
    <HomeStack.Screen
      name="HomeMain"
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <HomeStack.Screen
      name="LinkABHA"
      component={LinkABHAScreen}
      options={{ headerTitle: 'Link ABHA' }}
    />
    <HomeStack.Screen
      name="HSADetail"
      component={HSADetailScreen}
      options={{ headerTitle: '' }}
    />
    <HomeStack.Screen
      name="Contribute"
      component={ContributeScreen}
      options={{ headerTitle: '' }}
    />
    <HomeStack.Screen
      name="CheckIn"
      component={CheckInScreen}
      options={{ headerTitle: '' }}
    />
    <HomeStack.Screen
      name="RecordsVault"
      component={RecordsVaultScreen}
      options={{ headerTitle: '' }}
    />
    <HomeStack.Screen
      name="PrivacyCenter"
      component={PrivacyCenterScreen}
      options={{ headerTitle: '' }}
    />
    <HomeStack.Screen
      name="FamilyProfiles"
      component={FamilyProfilesScreen}
      options={{ headerTitle: '' }}
    />
  </HomeStack.Navigator>
);

export type InsuranceStackParamList = {
  InsuranceMain: undefined;
  Claims: undefined;
};

const InsuranceStack = createStackNavigator<InsuranceStackParamList>();

const InsuranceStackNavigator: React.FC = () => (
  <InsuranceStack.Navigator screenOptions={stackHeaderOptions}>
    <InsuranceStack.Screen
      name="InsuranceMain"
      component={InsuranceScreen}
      options={{ headerShown: false }}
    />
    <InsuranceStack.Screen
      name="Claims"
      component={ClaimsScreen}
      options={{ headerTitle: '' }}
    />
  </InsuranceStack.Navigator>
);

export type MainTabParamList = {
  HomeTab: undefined;
  InsuranceTab: undefined;
  RecordsTab: undefined;
  HealthTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TabIcon: React.FC<{ label: string; color: string }> = ({
  label,
  color,
}) => <Text style={[styles.tabIcon, { color }]}>{label}</Text>;

const MainNavigator: React.FC = () => {
  const { t } = useTranslation();
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
          height: 56,
        },
        tabBarLabelStyle: {
          ...typography.caption,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color }) => <TabIcon label="H" color={color} />,
        }}
      />
      <Tab.Screen
        name="InsuranceTab"
        component={InsuranceStackNavigator}
        options={{
          tabBarLabel: t('tabs.insurance'),
          tabBarIcon: ({ color }) => <TabIcon label="I" color={color} />,
        }}
      />
      <Tab.Screen
        name="RecordsTab"
        component={RecordsVaultScreen}
        options={{
          tabBarLabel: t('tabs.records'),
          tabBarIcon: ({ color }) => <TabIcon label="R" color={color} />,
        }}
      />
      <Tab.Screen
        name="HealthTab"
        component={HealthProfileScreen}
        options={{
          tabBarLabel: t('tabs.health'),
          tabBarIcon: ({ color }) => <TabIcon label="+" color={color} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color }) => <TabIcon label="P" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
});

export default MainNavigator;
