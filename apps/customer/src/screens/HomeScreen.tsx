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
import ContributionItem from '../components/home/ContributionItem';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { getDashboard } from '../api/hsa';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
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
    error,
    refetch,
    isRefetching,
  } = useQuery<{ data: Dashboard }>({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  const dashboard = dashboardData?.data;
  const isNoHsa = isError && (error as any)?.response?.status === 404;

  const handleQuickAction = (key: string) => {
    switch (key) {
      case 'clinician':
        break;
      case 'records':
        navigation.navigate('RecordsVault');
        break;
      case 'savings':
        navigation.navigate('HSADetail');
        break;
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          title={isNoHsa ? t('home.setup_hsa_title') : t('common.error')}
          subtitle={isNoHsa ? t('home.setup_hsa_subtitle') : t('common.error')}
          action={
            <Button
              title={isNoHsa ? t('home.setup_hsa_button') : t('common.retry')}
              onPress={() =>
                isNoHsa
                  ? navigation.navigate('LinkABHA')
                  : refetch()
              }
              variant="primary"
            />
          }
        />
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View>
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          {t('home.greeting', { name: user?.name || t('home.guest') })}
        </Text>
      </View>

      {/* Hero: Are you okay? */}
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>{t('home.hero_title')}</Text>
        <Text style={styles.heroSubtitle}>{t('home.hero_subtitle')}</Text>
        <Button
          title={t('home.start_checkin')}
          onPress={() => navigation.navigate('CheckIn')}
          variant="primary"
          style={styles.heroButton}
          textStyle={styles.heroButtonText}
        />
      </View>

      {/* Quick Actions Row */}
      <View style={styles.quickActionsSection}>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => handleQuickAction('clinician')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.secondaryLight }]}>
            <Text style={[styles.quickActionIconText, { color: colors.secondary }]}>+</Text>
          </View>
          <Text style={styles.quickActionLabel}>{t('home.talk_clinician')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => handleQuickAction('records')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.accentLight }]}>
            <Text style={[styles.quickActionIconText, { color: colors.accent }]}>R</Text>
          </View>
          <Text style={styles.quickActionLabel}>{t('home.my_records')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => handleQuickAction('savings')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.quickActionIconText, { color: colors.primary }]}>S</Text>
          </View>
          <Text style={styles.quickActionLabel}>{t('home.my_savings')}</Text>
        </TouchableOpacity>
      </View>

      {/* Trust Strip */}
      <TouchableOpacity
        style={styles.trustStrip}
        onPress={() => navigation.navigate('PrivacyCenter')}
        activeOpacity={0.7}
      >
        <Text style={styles.trustText}>{t('home.trust_statement')}</Text>
        <Text style={styles.trustLink}>{t('home.privacy_link')}</Text>
      </TouchableOpacity>

      {/* Balance Card */}
      <BalanceCard
        balance={dashboard?.hsa.balance ?? 0}
        onAddMoney={() => navigation.navigate('Contribute')}
      />

      {/* Insurance Progress */}
      <InsuranceProgressCard
        currentAmount={dashboard?.hsa.totalContributed ?? 0}
        targetAmount={dashboard?.hsa.insuranceThreshold ?? 0}
        isEligible={dashboard?.hsa.insuranceEligible ?? false}
      />

      {/* Recent Contributions Header */}
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
  // Hero Section
  heroSection: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  heroTitle: {
    ...typography.displaySmall,
    color: colors.surface,
  },
  heroSubtitle: {
    ...typography.bodyLarge,
    color: colors.surface,
    opacity: 0.85,
    marginTop: spacing.xs,
  },
  heroButton: {
    backgroundColor: colors.surface,
    marginTop: spacing.md,
  },
  heroButtonText: {
    color: colors.primary,
  },
  // Quick Actions
  quickActionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionIconText: {
    fontSize: 20,
    fontWeight: '700',
  },
  quickActionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Trust Strip
  trustStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    backgroundColor: colors.secondaryLight,
    borderRadius: borderRadius.lg,
  },
  trustText: {
    ...typography.bodySmall,
    color: colors.secondary,
    fontWeight: '500',
  },
  trustLink: {
    ...typography.bodySmall,
    color: colors.secondary,
    fontWeight: '700',
    marginLeft: spacing.xs,
    textDecorationLine: 'underline',
  },
  // Sections
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
