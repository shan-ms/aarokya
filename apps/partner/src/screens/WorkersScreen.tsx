import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { WorkerWithHsa } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { useAuthStore } from '../store/authStore';
import { usePartnerStore } from '../store/partnerStore';
import WorkerCard from '../components/partner/WorkerCard';
import Input from '../components/common/Input';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

interface WorkersScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

const WorkersScreen: React.FC<WorkersScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const partner = useAuthStore((state) => state.partner);
  const {
    workers,
    workersLoading,
    workersError,
    workersHasMore,
    fetchWorkers,
    fetchMoreWorkers,
  } = usePartnerStore();

  const [searchQuery, setSearchQuery] = useState('');

  const loadWorkers = useCallback(() => {
    if (partner?.id) {
      fetchWorkers(partner.id, { search: searchQuery || undefined });
    }
  }, [partner?.id, searchQuery, fetchWorkers]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (partner?.id) {
        fetchWorkers(partner.id, { search: searchQuery || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, partner?.id, fetchWorkers]);

  const handleWorkerPress = (worker: WorkerWithHsa) => {
    navigation.navigate('WorkerDetail', { workerId: worker.id });
  };

  const handleLoadMore = () => {
    if (partner?.id && workersHasMore) {
      fetchMoreWorkers(partner.id);
    }
  };

  const renderItem = ({ item }: { item: WorkerWithHsa }) => (
    <WorkerCard worker={item} onPress={handleWorkerPress} />
  );

  const renderFooter = () => {
    if (!workersLoading || workers.length === 0) return null;
    return <LoadingSpinner size="small" />;
  };

  const renderEmpty = () => {
    if (workersLoading) return null;
    if (workersError) {
      return (
        <EmptyState
          title={t('common.error')}
          description={workersError}
          actionLabel={t('common.retry')}
          onAction={loadWorkers}
        />
      );
    }
    return (
      <EmptyState
        title={t('workers.noWorkers')}
        description={t('workers.noWorkersDesc')}
        actionLabel={t('workers.addWorker')}
        onAction={() => navigation.navigate('AddWorker')}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('workers.title')}</Text>
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder={t('workers.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      {workersLoading && workers.length === 0 ? (
        <LoadingSpinner fullScreen message={t('common.loading')} />
      ) : (
        <FlatList
          data={workers}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={workersLoading && workers.length > 0}
              onRefresh={loadWorkers}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddWorker')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    marginBottom: spacing.sm,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '400',
    color: colors.surface,
    marginTop: -2,
  },
});

export default WorkersScreen;
