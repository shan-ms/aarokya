import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Alert,
  Linking,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Report } from '../types';
import { colors } from '../theme/colors';
import { typography, fontSizes } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { getReports } from '../api/contributions';
import { useAuthStore } from '../store/authStore';
import ReportCard from '../components/partner/ReportCard';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Card from '../components/common/Card';

interface ReportsScreenProps {
  navigation: { navigate: (screen: string) => void };
}

const formatCurrency = (paise: number): string => {
  const rupees = paise / 100;
  return `\u20b9${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatDateInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const isValidDateString = (dateStr: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

const ReportsScreen: React.FC<ReportsScreenProps> = () => {
  const { t } = useTranslation();
  const partner = useAuthStore((state) => state.partner);

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState(formatDateInput(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(formatDateInput(today));
  const [queryDates, setQueryDates] = useState({
    start: formatDateInput(thirtyDaysAgo),
    end: formatDateInput(today),
  });

  const {
    data: reports = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<Report[]>({
    queryKey: ['partner-reports', partner?.id, queryDates.start, queryDates.end],
    queryFn: async () => {
      if (!partner?.id) throw new Error('No partner ID');
      const response = await getReports(partner.id, {
        startDate: queryDates.start,
        endDate: queryDates.end,
      });
      return response.data;
    },
    enabled: !!partner?.id,
    staleTime: 60000,
  });

  const handleGenerate = useCallback(() => {
    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      Alert.alert(t('common.error'), 'Please enter valid dates in YYYY-MM-DD format');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      Alert.alert(t('common.error'), 'Start date must be before end date');
      return;
    }
    setQueryDates({ start: startDate, end: endDate });
  }, [startDate, endDate, t]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleDownload = async (report: Report) => {
    if (report.downloadUrl) {
      try {
        await Linking.openURL(report.downloadUrl);
      } catch {
        Alert.alert(t('common.error'), 'Could not open download link');
      }
    }
  };

  const handleExportCsv = () => {
    Alert.alert(t('reports.export'), t('reports.exportSuccess'));
  };

  const summaryStats = reports.reduce(
    (acc, report) => ({
      totalPaise: acc.totalPaise + report.totalAmountPaise,
      workerCount: acc.workerCount + report.workerCount,
      contributionCount: acc.contributionCount + report.contributionCount,
    }),
    { totalPaise: 0, workerCount: 0, contributionCount: 0 },
  );

  if (isLoading) {
    return <LoadingSpinner fullScreen message={t('common.loading')} />;
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
        <Text style={styles.title}>{t('reports.title')}</Text>

        <Card style={styles.dateRangeCard}>
          <Text style={styles.dateRangeLabel}>{t('reports.dateRange')}</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>{t('reports.startDate')}</Text>
              <View style={styles.dateInputContainer}>
                <TextInput
                  style={styles.dateTextInput}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={10}
                />
              </View>
            </View>
            <Text style={styles.dateSeparator}>to</Text>
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>{t('reports.endDate')}</Text>
              <View style={styles.dateInputContainer}>
                <TextInput
                  style={styles.dateTextInput}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={10}
                />
              </View>
            </View>
          </View>
          <Button
            title={t('reports.generate')}
            onPress={handleGenerate}
            variant="outline"
            size="sm"
            style={styles.generateButton}
          />
        </Card>

        {reports.length > 0 && (
          <View style={styles.summaryRow}>
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {formatCurrency(summaryStats.totalPaise)}
              </Text>
              <Text style={styles.summaryLabel}>
                {t('reports.totalContributed')}
              </Text>
            </Card>
            <View style={styles.summaryGap} />
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{summaryStats.workerCount}</Text>
              <Text style={styles.summaryLabel}>{t('reports.workersCovered')}</Text>
            </Card>
            <View style={styles.summaryGap} />
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {summaryStats.contributionCount}
              </Text>
              <Text style={styles.summaryLabel}>{t('reports.contributions')}</Text>
            </Card>
          </View>
        )}

        {isError ? (
          <EmptyState
            title={t('common.error')}
            description={error instanceof Error ? error.message : 'Failed to load reports'}
            actionLabel={t('common.retry')}
            onAction={handleRefresh}
          />
        ) : reports.length > 0 ? (
          <>
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onDownload={handleDownload}
              />
            ))}
            <Button
              title={t('reports.export')}
              onPress={handleExportCsv}
              variant="outline"
              size="md"
              style={styles.exportButton}
            />
          </>
        ) : (
          <EmptyState
            title={t('reports.noReports')}
            description={t('reports.noReportsDesc')}
          />
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
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginBottom: spacing.xxl,
  },
  dateRangeCard: {
    marginBottom: spacing.xxl,
  },
  dateRangeLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  dateField: {
    flex: 1,
  },
  dateFieldLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  dateInputContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  dateTextInput: {
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    padding: spacing.md,
  },
  dateSeparator: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  generateButton: {
    alignSelf: 'flex-start',
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: spacing.xxl,
  },
  summaryGap: {
    width: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
  },
  summaryValue: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  exportButton: {
    marginTop: spacing.lg,
    alignSelf: 'center',
  },
});

export default ReportsScreen;
