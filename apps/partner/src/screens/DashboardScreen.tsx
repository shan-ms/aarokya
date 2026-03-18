import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { useAuthStore } from '../store/authStore';
import { getDashboard } from '../api/partner';
import { Contribution, PartnerDashboard } from '../types';
import DashboardMetricCard from '../components/partner/DashboardMetricCard';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Card from '../components/common/Card';

interface DashboardScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

const formatCurrency = (paise: number): string => {
  const rupees = paise / 100;
  if (rupees >= 100000) {
    return `\u20b9${(rupees / 100000).toFixed(1)}L`;
  }
  if (rupees >= 1000) {
    return `\u20b9${(rupees / 1000).toFixed(1)}K`;
  }
  return `\u20b9${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatFullCurrency = (paise: number): string => {
  const rupees = paise / 100;
  return `\u20b9${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
};

const CoverageProgressBar: React.FC<{ rate: number }> = ({ rate }) => {
  const clampedRate = Math.min(Math.max(rate, 0), 100);
  const progressColor =
    clampedRate >= 75
      ? colors.success
      : clampedRate >= 50
      ? colors.accent
      : colors.error;

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.header}>
        <Text style={progressStyles.label}>Coverage Rate</Text>
        <Text style={[progressStyles.value, { color: progressColor }]}>
          {clampedRate}%
        </Text>
      </View>
      <View style={progressStyles.trackContainer}>
        <View style={progressStyles.track}>
          <View
            style={[
              progressStyles.fill,
              {
                width: `${clampedRate}%`,
                backgroundColor: progressColor,
              },
            ]}
          />
        </View>
      </View>
      <Text style={progressStyles.hint}>
        {clampedRate >= 75
          ? 'Excellent coverage'
          : clampedRate >= 50
          ? 'Good progress'
          : 'Consider enrolling more workers'}
      </Text>
    </View>
  );
};

const progressStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    ...typography.headlineLarge,
  },
  trackContainer: {
    marginBottom: spacing.sm,
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.divider,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  hint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const partner = useAuthStore((state) => state.partner);

  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<PartnerDashboard>({
    queryKey: ['partner-dashboard', partner?.id],
    queryFn: async () => {
      if (!partner?.id) throw new Error('No partner ID');
      const response = await getDashboard(partner.id);
      return response.data;
    },
    enabled: !!partner?.id,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const dashboard = dashboardData ?? null;

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const renderActivityItem = ({ item }: { item: Contribution }) => (
    <View style={styles.activityItem}>
      <View style={styles.activityDot} />
      <View style={styles.activityContent}>
        <Text style={styles.activityName} numberOfLines={1}>
          {item.workerName}
        </Text>
        <Text style={styles.activityDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <View style={styles.activityRight}>
        <Text style={styles.activityAmount}>
          {formatFullCurrency(item.amountPaise)}
        </Text>
        <View
          style={[
            styles.activityStatusDot,
            {
              backgroundColor:
                item.status === 'completed'
                  ? colors.success
                  : item.status === 'pending'
                  ? colors.warning
                  : colors.error,
            },
          ]}
        />
      </View>
    </View>
  );

  if (isLoading) {
    return <LoadingSpinner fullScreen message={t('common.loading')} />;
  }

  if (isError && !dashboard) {
    return (
      <EmptyState
        title={t('common.error')}
        description={error instanceof Error ? error.message : t('common.error')}
        actionLabel={t('common.retry')}
        onAction={handleRefresh}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>
                {t('dashboard.greeting')}, {partner?.businessName ?? 'Partner'}
              </Text>
              <Text style={styles.title}>{t('dashboard.title')}</Text>
            </View>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.7}
            >
              <Text style={styles.profileButtonText}>
                {partner?.businessName?.charAt(0).toUpperCase() ?? 'P'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <DashboardMetricCard
            icon={<Text style={styles.metricIcon}>P</Text>}
            label={t('dashboard.totalWorkers')}
            value={String(dashboard?.totalWorkers ?? 0)}
            onPress={() => navigation.navigate('WorkersTab')}
          />
          <View style={styles.metricGap} />
          <DashboardMetricCard
            icon={<Text style={styles.metricIcon}>{'\u20b9'}</Text>}
            label={t('dashboard.totalContributed')}
            value={formatCurrency(dashboard?.totalContributedPaise ?? 0)}
            onPress={() => navigation.navigate('ReportsTab')}
          />
        </View>

        <Card style={styles.coverageCard}>
          <CoverageProgressBar rate={dashboard?.coverageRate ?? 0} />
        </Card>

        <View style={styles.actionsRow}>
          <Button
            title={t('dashboard.addWorker')}
            onPress={() => navigation.navigate('AddWorker')}
            variant="outline"
            size="md"
            style={styles.actionButton}
          />
          <View style={styles.actionGap} />
          <Button
            title={t('dashboard.contribute')}
            onPress={() => navigation.navigate('Contribute')}
            variant="primary"
            size="md"
            style={styles.actionButton}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dashboard.recentActivity')}</Text>
        </View>

        {dashboard?.recentContributions && dashboard.recentContributions.length > 0 ? (
          <Card style={styles.activityCard}>
            {dashboard.recentContributions.map((item, index) => (
              <View key={item.id}>
                {renderActivityItem({ item })}
                {index < dashboard.recentContributions.length - 1 && (
                  <View style={styles.activityDivider} />
                )}
              </View>
            ))}
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('dashboard.noActivity')}</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  profileButtonText: {
    ...typography.headlineSmall,
    color: colors.primary,
  },
  greeting: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  metricGap: {
    width: spacing.sm,
  },
  metricIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  coverageCard: {
    marginBottom: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: spacing.xxl,
  },
  actionGap: {
    width: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  activityCard: {
    padding: 0,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    marginRight: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activityDate: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  activityRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityAmount: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.secondary,
    marginRight: spacing.sm,
  },
  activityStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activityDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.lg,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
  },
});

export default DashboardScreen;
