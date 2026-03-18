import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Report } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
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

const ReportsScreen: React.FC<ReportsScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const partner = useAuthStore((state) => state.partner);

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState(formatDateInput(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(formatDateInput(today));

  const loadReports = useCallback(async () => {
    if (!partner?.id) return;
    try {
      const response = await getReports(partner.id, { startDate, endDate });
      setReports(response.data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load reports';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [partner?.id, startDate, endDate]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const handleDownload = async (report: Report) => {
    if (report.downloadUrl) {
      try {
        await Linking.openURL(report.downloadUrl);
      } catch {
        Alert.alert(t('common.error'), 'Could not open download link');
      }
    }
  };

  const summaryStats = reports.reduce(
    (acc, report) => ({
      totalPaise: acc.totalPaise + report.totalAmountPaise,
      workerCount: acc.workerCount + report.workerCount,
      contributionCount: acc.contributionCount + report.contributionCount,
    }),
    { totalPaise: 0, workerCount: 0, contributionCount: 0 },
  );

  if (loading) {
    return <LoadingSpinner fullScreen message={t('common.loading')} />;
  }

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
        <Text style={styles.title}>{t('reports.title')}</Text>

        <Card style={styles.dateRangeCard}>
          <Text style={styles.dateRangeLabel}>{t('reports.dateRange')}</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>{t('reports.startDate')}</Text>
              <TouchableOpacity style={styles.dateInput}>
                <Text style={styles.dateInputText}>{startDate}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.dateSeparator}>to</Text>
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>{t('reports.endDate')}</Text>
              <TouchableOpacity style={styles.dateInput}>
                <Text style={styles.dateInputText}>{endDate}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Button
            title={t('reports.generate')}
            onPress={loadReports}
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

        {error ? (
          <EmptyState
            title={t('common.error')}
            description={error}
            actionLabel={t('common.retry')}
            onAction={loadReports}
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
              onPress={() => {
                Alert.alert(t('reports.export'), 'Export functionality coming soon');
              }}
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
  dateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  dateInputText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
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
