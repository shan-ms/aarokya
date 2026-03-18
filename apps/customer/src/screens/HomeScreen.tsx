import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import BalanceCard from '../components/home/BalanceCard';
import InsuranceProgressCard from '../components/home/InsuranceProgressCard';
import QuickActions from '../components/home/QuickActions';
import ContributionItem from '../components/home/ContributionItem';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { getDashboard } from '../api/hsa';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Dashboard, Contribution } from '../types';

const HomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);

  const {
    data: dashboardData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<{ data: Dashboard }>({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  const dashboard = dashboardData?.data;

  const handleQuickAction = (key: string) => {
    switch (key) {
      case 'contribute':
        navigation.navigate('Contribute');
        break;
      case 'insurance':
        navigation.navigate('InsuranceTab');
        break;
      case 'health_records':
        navigation.navigate('HealthTab');
        break;
      case 'help':
        break;
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const renderHeader = () => (
    <View>
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          {t('home.greeting', { name: user?.name || '' })}
        </Text>
      </View>

      <BalanceCard
        balance={dashboard?.hsa.balance ?? 0}
        onAddMoney={() => navigation.navigate('Contribute')}
      />

      <InsuranceProgressCard
        currentAmount={dashboard?.hsa.totalContributed ?? 0}
        targetAmount={dashboard?.hsa.insuranceThreshold ?? 0}
        isEligible={dashboard?.hsa.insuranceEligible ?? false}
      />

      <QuickActions onAction={handleQuickAction} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {t('home.recent_contributions')}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('HSADetail')}
        >
          <Text style={styles.viewAll}>{t('home.view_all')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderContributionItem = ({ item }: { item: Contribution }) => (
    <ContributionItem contribution={item} />
  );

  const renderEmpty = () => (
    <EmptyState
      title={t('home.no_contributions')}
      subtitle={t('home.start_saving')}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={dashboard?.recentContributions ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderContributionItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  greeting: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  greetingText: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  viewAll: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default HomeScreen;
