import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Contribution, ContributionSource } from '../../types';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatCurrency } from './BalanceCard';

interface ContributionItemProps {
  contribution: Contribution;
}

const sourceIcons: Record<ContributionSource, string> = {
  self: 'S',
  employer: 'E',
  government: 'G',
  platform_cashback: 'C',
  referral: 'R',
};

const sourceColors: Record<ContributionSource, string> = {
  self: colors.primary,
  employer: colors.secondary,
  government: colors.accent,
  platform_cashback: colors.info,
  referral: '#8B5CF6',
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const ContributionItem: React.FC<ContributionItemProps> = ({ contribution }) => {
  const { t } = useTranslation();
  const iconLetter = sourceIcons[contribution.source];
  const iconColor = sourceColors[contribution.source];

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '1A' }]}>
        <Text style={[styles.iconText, { color: iconColor }]}>{iconLetter}</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.source}>
          {t(`source.${contribution.source}`)}
        </Text>
        <Text style={styles.date}>{formatDate(contribution.createdAt)}</Text>
      </View>
      <Text style={styles.amount}>+₹{formatCurrency(contribution.amount)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    ...typography.bodyLarge,
    fontWeight: '700',
  },
  details: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  source: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  date: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  amount: {
    ...typography.bodyLarge,
    color: colors.secondary,
    fontWeight: '600',
  },
});

export default ContributionItem;
