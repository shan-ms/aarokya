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
import { useInfiniteQuery } from '@tanstack/react-query';
import ContributionItem from '../components/home/ContributionItem';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { listContributions } from '../api/contributions';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Contribution, ContributionSource } from '../types';

type FilterTab = 'all' | ContributionSource;

const filterTabs: { key: FilterTab; labelKey: string }[] = [
  { key: 'all', labelKey: 'hsa_detail.all' },
  { key: 'self', labelKey: 'hsa_detail.self' },
  { key: 'employer', labelKey: 'hsa_detail.employer' },
  { key: 'government', labelKey: 'hsa_detail.government' },
  { key: 'platform_cashback', labelKey: 'hsa_detail.cashback' },
  { key: 'referral', labelKey: 'hsa_detail.referral' },
];

const HSADetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

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
        source: activeFilter === 'all' ? undefined : activeFilter,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });

  const contributions: Contribution[] =
    data?.pages.flatMap((page) => page.data) ?? [];

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

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t('hsa_detail.title')}</Text>
      {renderFilterTabs()}
      <FlatList
        data={contributions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ContributionItem contribution={item} />}
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
