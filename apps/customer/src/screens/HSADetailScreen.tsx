import React, { useState, useCallback } from 'react';
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
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import ContributionItem from '../components/home/ContributionItem';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Card from '../components/common/Card';
import { listContributions, getContributionSummary } from '../api/contributions';
import { formatCurrency } from '../components/home/BalanceCard';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Contribution, ContributionSource, ContributionSummary, ApiResponse } from '../types';

type FilterTab = 'all' | 'self' | 'employer' | 'government';

const filterTabs: { key: FilterTab; labelKey: string }[] = [
  { key: 'all', labelKey: 'hsa_detail.all' },
  { key: 'self', labelKey: 'hsa_detail.self' },
  { key: 'employer', labelKey: 'hsa_detail.partner' },
  { key: 'government', labelKey: 'hsa_detail.government' },
];

const HSADetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const { data: summaryData } = useQuery<ApiResponse<ContributionSummary>>({
    queryKey: ['contribution-summary'],
    queryFn: getContributionSummary,
  });

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['contributions', activeFilter],
    queryFn: ({ pageParam = 1 }) =>
      listContributions({
        page: pageParam,
        pageSize: 20,
        source: activeFilter === 'all' ? undefined : (activeFilter as ContributionSource),
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });

  const contributions: Contribution[] =
    data?.pages.flatMap((page) => page.data) ?? [];
  const summary = summaryData?.data;

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFilterTabs = () => (
    <View style={styles.filterContainer}>
      <FlatList
        data={filterTabs}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === item.key && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(item.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === item.key && styles.filterTabTextActive,
              ]}
            >
              {t(item.labelKey)}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.filterList}
      />
    </View>
  );

  const renderMonthlyChart = () => (
    <Card style={styles.chartCard}>
      <Text style={styles.chartTitle}>{t('hsa_detail.monthly_chart')}</Text>
      <View style={styles.chartPlaceholder}>
        <View style={styles.chartBars}>
          {[0.3, 0.5, 0.7, 0.4, 0.8, 0.6].map((height, index) => (
            <View key={index} style={styles.chartBarContainer}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: height * 80,
                    backgroundColor:
                      index === 5 ? colors.primary : colors.primaryLight,
                  },
                ]}
              />
              <Text style={styles.chartBarLabel}>
                {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'][index]}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {summary && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>
              {'\u20B9'}{formatCurrency(summary.total)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Avg/month</Text>
            <Text style={styles.summaryValue}>
              {'\u20B9'}{formatCurrency(summary.monthlyAverage)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Streak</Text>
            <Text style={styles.summaryValue}>{summary.streak} mo</Text>
          </View>
        </View>
      )}
    </Card>
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={contributions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ContributionItem contribution={item} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{t('hsa_detail.title')}</Text>
            {renderMonthlyChart()}
            {renderFilterTabs()}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('hsa_detail.no_history')}
            subtitle={t('hsa_detail.no_history_subtitle')}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <LoadingSpinner size="small" />
            </View>
          ) : null
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
  title: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  chartCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  chartTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  chartPlaceholder: {
    height: 120,
    justifyContent: 'flex-end',
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 100,
    paddingBottom: spacing.sm,
  },
  chartBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  chartBar: {
    width: 24,
    borderRadius: borderRadius.sm,
    minHeight: 4,
  },
  chartBarLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  summaryValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  filterContainer: {
    marginTop: spacing.md,
  },
  filterList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filterTab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.divider,
    marginRight: spacing.sm,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: colors.surface,
  },
  footer: {
    paddingVertical: spacing.md,
  },
});

export default HSADetailScreen;
