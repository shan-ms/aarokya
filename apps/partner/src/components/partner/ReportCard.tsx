import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Report } from '../../types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import Card from '../common/Card';

interface ReportCardProps {
  report: Report;
  onDownload?: (report: Report) => void;
}

const formatCurrency = (paise: number): string => {
  const rupees = paise / 100;
  return `\u20b9${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ReportCard: React.FC<ReportCardProps> = ({ report, onDownload }) => {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.dateRange}>
          <Text style={styles.dateText}>
            {formatDate(report.startDate)} - {formatDate(report.endDate)}
          </Text>
        </View>
        {onDownload && report.downloadUrl && (
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={() => onDownload(report)}
            activeOpacity={0.7}
          >
            <Text style={styles.downloadText}>Download</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{formatCurrency(report.totalAmountPaise)}</Text>
          <Text style={styles.metricLabel}>Total Amount</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{report.workerCount}</Text>
          <Text style={styles.metricLabel}>Workers</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{report.contributionCount}</Text>
          <Text style={styles.metricLabel}>Contributions</Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dateRange: {
    flex: 1,
  },
  dateText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  downloadButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
  },
  downloadText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.divider,
  },
});

export default ReportCard;
