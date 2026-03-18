import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { useAuthStore } from '../store/authStore';
import { usePartnerStore } from '../store/partnerStore';
import { Contribution } from '../types';
import DashboardMetricCard from '../components/partner/DashboardMetricCard';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Card from '../components/common/Card';

interface DashboardScreenProps {
  navigation: { navigate: (screen: string) => void };
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

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const partner = useAuthStore((state) => state.partner);
  const {
    dashboard,
    dashboardLoading,
    dashboardError,
    fetchDashboard,
  } = usePartnerStore();

  const loadDashboard = useCallback(() => {
    if (partner?.id) {
      fetchDashboard(partner.id);
    }
  }, [partner?.id, fetchDashboard]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const renderActivityItem = ({ item }: { item: Contribution }) => (
    <View style={styles.activityItem}>
      <View style={styles.activityDot} />
      <View style={styles.activityContent}>
        <Text style={styles.activityName} numberOfLines={1}>
          {item.workerName}
        </Text>
        <Text style={styles.activityDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.activityAmount}>
        {formatFullCurrency(item.amountPaise)}
      </Text>
    </View>
  );

  if (dashboardLoading && !dashboard) {
    return <LoadingSpinner fullScreen message={t('common.loading')} />;
  }

  if (dashboardError && !dashboard) {
    return (
      <EmptyState
        title={t('common.error')}
        description={dashboardError}
        actionLabel={t('common.retry')}
        onAction={loadDashboard}
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
            refreshing={dashboardLoading}
            onRefresh={loadDashboard}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {t('dashboard.greeting')}, {partner?.businessName ?? 'Partner'}
          </Text>
          <Text style={styles.title}>{t('dashboard.title')}</Text>
        </View>

        <View style={styles.metricsRow}>
          <DashboardMetricCard
            icon={<Text style={styles.metricIcon}>P</Text>}
            label={t('dashboard.totalWorkers')}
            value={String(dashboard?.totalWorkers ?? 0)}
          />
          <View style={styles.metricGap} />
          <DashboardMetricCard
            icon={<Text style={styles.metricIcon}>{'\u20b9'}</Text>}
            label={t('dashboard.totalContributed')}
            value={formatCurrency(dashboard?.totalContributedPaise ?? 0)}
          />
          <View style={styles.metricGap} />
          <DashboardMetricCard
            icon={<Text style={styles.metricIcon}>%</Text>}
            label={t('dashboard.coverageRate')}
            value={`${dashboard?.coverageRate ?? 0}%`}
          />
        </View>

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
    marginBottom: spacing.xxl,
  },
  metricGap: {
    width: spacing.sm,
  },
  metricIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
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
  activityAmount: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.secondary,
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
