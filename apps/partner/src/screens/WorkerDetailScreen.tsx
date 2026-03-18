import React, { useEffect, useState, useCallback } from 'react';
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
import { WorkerWithHsa, Contribution, InsuranceStatus } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { getWorkerDetail } from '../api/workers';
import { getContributionHistory } from '../api/contributions';
import { useAuthStore } from '../store/authStore';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

interface WorkerDetailScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
  route: {
    params: {
      workerId: string;
    };
  };
}

const formatCurrency = (paise: number): string => {
  const rupees = paise / 100;
  return `\u20b9${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getInsuranceInfo = (
  status: InsuranceStatus,
): { label: string; color: string; bg: string } => {
  switch (status) {
    case 'active':
      return { label: 'Active', color: colors.success, bg: colors.secondaryLight };
    case 'pending':
      return { label: 'Pending', color: colors.accent, bg: colors.accentLight };
    case 'expired':
      return { label: 'Expired', color: colors.error, bg: colors.errorLight };
    case 'none':
    default:
      return { label: 'None', color: colors.textTertiary, bg: colors.divider };
  }
};

const WorkerDetailScreen: React.FC<WorkerDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const { workerId } = route.params;
  const partner = useAuthStore((state) => state.partner);

  const [worker, setWorker] = useState<WorkerWithHsa | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!partner?.id) return;
    try {
      const [workerRes, contribRes] = await Promise.all([
        getWorkerDetail(partner.id, workerId),
        getContributionHistory(partner.id, { workerId }),
      ]);
      setWorker(workerRes.data);
      setContributions(contribRes.data.items);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load worker details';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [partner?.id, workerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return <LoadingSpinner fullScreen message={t('common.loading')} />;
  }

  if (error || !worker) {
    return (
      <EmptyState
        title={t('common.error')}
        description={error ?? 'Worker not found'}
        actionLabel={t('common.retry')}
        onAction={loadData}
      />
    );
  }

  const insuranceInfo = getInsuranceInfo(worker.insuranceStatus);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {worker.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{worker.name}</Text>
          <Text style={styles.phone}>{worker.phone}</Text>
          {worker.abhaId && (
            <Text style={styles.abha}>ABHA: {worker.abhaId}</Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>{t('workerDetail.hsaBalance')}</Text>
            <Text style={styles.statValue}>
              {formatCurrency(worker.hsaBalancePaise)}
            </Text>
          </Card>
          <View style={styles.statGap} />
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>{t('workerDetail.insuranceStatus')}</Text>
            <View style={[styles.insuranceBadge, { backgroundColor: insuranceInfo.bg }]}>
              <Text style={[styles.insuranceBadgeText, { color: insuranceInfo.color }]}>
                {insuranceInfo.label}
              </Text>
            </View>
            {worker.insuranceExpiresAt && worker.insuranceStatus === 'active' && (
              <Text style={styles.expiryText}>
                Expires {formatDate(worker.insuranceExpiresAt)}
              </Text>
            )}
          </Card>
        </View>

        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('workerDetail.totalContributed')}</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(worker.totalContributionsFromPartnerPaise)}
          </Text>
          {worker.lastContributionAt && (
            <Text style={styles.lastContrib}>
              {t('workers.lastContribution')}: {formatDate(worker.lastContributionAt)}
            </Text>
          )}
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('workerDetail.contributionHistory')}
          </Text>
        </View>

        {contributions.length > 0 ? (
          <Card style={styles.historyCard}>
            {contributions.map((item, index) => (
              <View key={item.id}>
                <View style={styles.historyItem}>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyDate}>
                      {formatDate(item.createdAt)}
                    </Text>
                    <Text style={styles.historySource}>{item.sourceType}</Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyAmount}>
                      {formatCurrency(item.amountPaise)}
                    </Text>
                    <View
                      style={[
                        styles.statusDot,
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
                {index < contributions.length - 1 && (
                  <View style={styles.historyDivider} />
                )}
              </View>
            ))}
          </Card>
        ) : (
          <Card style={styles.emptyHistoryCard}>
            <Text style={styles.emptyHistoryText}>
              {t('workerDetail.noContributions')}
            </Text>
          </Card>
        )}

        <Button
          title={t('workerDetail.contribute')}
          onPress={() =>
            navigation.navigate('Contribute', { preselectedWorkerId: workerId })
          }
          size="lg"
          style={styles.contributeButton}
        />
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
  profileSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  name: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  phone: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  abha: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  statGap: {
    width: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
  },
  insuranceBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  insuranceBadgeText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  expiryText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  totalCard: {
    marginBottom: spacing.xxl,
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
  },
  totalLabel: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  totalValue: {
    ...typography.displaySmall,
    color: colors.primary,
  },
  lastContrib: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  historyCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.xxl,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  historyInfo: {
    flex: 1,
  },
  historyDate: {
    ...typography.bodyMedium,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  historySource: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyAmount: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.lg,
  },
  emptyHistoryCard: {
    alignItems: 'center',
    padding: spacing.xxxl,
    marginBottom: spacing.xxl,
  },
  emptyHistoryText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
  },
  contributeButton: {
    width: '100%',
  },
});

export default WorkerDetailScreen;
