import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ContributionSourceType } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { useAuthStore } from '../store/authStore';
import { usePartnerStore } from '../store/partnerStore';
import ContributionForm from '../components/partner/ContributionForm';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface ContributeScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
  route: {
    params?: {
      preselectedWorkerId?: string;
    };
  };
}

type TabMode = 'individual' | 'bulk';

const ContributeScreen: React.FC<ContributeScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const partner = useAuthStore((state) => state.partner);
  const { workers, workersLoading, fetchWorkers } = usePartnerStore();

  const [activeTab, setActiveTab] = useState<TabMode>('individual');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  const preselectedWorkerId = route.params?.preselectedWorkerId;

  useEffect(() => {
    if (partner?.id) {
      fetchWorkers(partner.id);
    }
  }, [partner?.id, fetchWorkers]);

  useEffect(() => {
    if (preselectedWorkerId) {
      setSelectedWorkerIds([preselectedWorkerId]);
      setActiveTab('individual');
    }
  }, [preselectedWorkerId]);

  const handleWorkerToggle = useCallback(
    (workerId: string) => {
      if (activeTab === 'individual') {
        setSelectedWorkerIds([workerId]);
      } else {
        setSelectedWorkerIds((prev) =>
          prev.includes(workerId)
            ? prev.filter((id) => id !== workerId)
            : [...prev, workerId],
        );
      }
    },
    [activeTab],
  );

  const handleSubmit = (amountPaise: number, sourceType: ContributionSourceType) => {
    navigation.navigate('PaymentConfirm', {
      workerIds: selectedWorkerIds,
      amountPerWorkerPaise: amountPaise,
      sourceType,
      mode: activeTab,
    });
  };

  const handleTabChange = (tab: TabMode) => {
    setActiveTab(tab);
    setSelectedWorkerIds([]);
  };

  if (workersLoading && workers.length === 0) {
    return <LoadingSpinner fullScreen message={t('common.loading')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('contribute.title')}</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'individual' && styles.tabActive]}
          onPress={() => handleTabChange('individual')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'individual' && styles.tabTextActive,
            ]}
          >
            {t('contribute.individual')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bulk' && styles.tabActive]}
          onPress={() => handleTabChange('bulk')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'bulk' && styles.tabTextActive,
            ]}
          >
            {t('contribute.bulk')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ContributionForm
          workers={workers}
          selectedWorkerIds={selectedWorkerIds}
          onWorkerToggle={handleWorkerToggle}
          onSubmit={handleSubmit}
          mode={activeTab}
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
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.xxl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.divider,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  tabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.huge,
  },
});

export default ContributeScreen;
