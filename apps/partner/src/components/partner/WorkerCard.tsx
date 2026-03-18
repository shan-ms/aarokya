import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WorkerWithHsa, InsuranceStatus } from '../../types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import Card from '../common/Card';

interface WorkerCardProps {
  worker: WorkerWithHsa;
  onPress?: (worker: WorkerWithHsa) => void;
}

const formatCurrency = (paise: number): string => {
  const rupees = paise / 100;
  return `\u20b9${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const getInsuranceBadge = (
  status: InsuranceStatus,
): { label: string; bg: string; text: string } => {
  switch (status) {
    case 'active':
      return { label: 'Insured', bg: colors.secondaryLight, text: colors.secondary };
    case 'pending':
      return { label: 'Pending', bg: colors.accentLight, text: colors.accent };
    case 'expired':
      return { label: 'Expired', bg: colors.errorLight, text: colors.error };
    case 'none':
    default:
      return { label: 'No Insurance', bg: colors.divider, text: colors.textTertiary };
  }
};

const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onPress }) => {
  const badge = getInsuranceBadge(worker.insuranceStatus);

  return (
    <Card style={styles.card} onPress={onPress ? () => onPress(worker) : undefined}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {worker.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {worker.name}
          </Text>
          <Text style={styles.phone}>{worker.phone}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.balance}>{formatCurrency(worker.hsaBalancePaise)}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.headlineSmall,
    color: colors.primary,
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  phone: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  balance: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
});

export default WorkerCard;
