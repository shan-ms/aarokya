import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatCurrency } from './BalanceCard';

interface InsuranceProgressCardProps {
  /** Current total contributed in paise */
  currentAmount: number;
  /** Target threshold in paise */
  targetAmount: number;
  isEligible: boolean;
}

const InsuranceProgressCard: React.FC<InsuranceProgressCardProps> = ({
  currentAmount,
  targetAmount,
  isEligible,
}) => {
  const { t } = useTranslation();
  const progress = targetAmount > 0 ? currentAmount / targetAmount : 0;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('home.insurance_progress')}</Text>
      {isEligible ? (
        <View style={styles.eligibleBadge}>
          <Text style={styles.eligibleText}>{t('home.eligible')}</Text>
        </View>
      ) : (
        <>
          <ProgressBar
            progress={progress}
            color={colors.secondary}
            backgroundColor={colors.secondaryLight}
            height={10}
            style={styles.progress}
          />
          <Text style={styles.progressText}>
            {t('home.progress_text', {
              current: formatCurrency(currentAmount),
              target: formatCurrency(targetAmount),
            })}
          </Text>
        </>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  title: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  progress: {
    marginTop: spacing.sm,
  },
  progressText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  eligibleBadge: {
    backgroundColor: colors.secondaryLight,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  eligibleText: {
    ...typography.bodyMedium,
    color: colors.secondary,
    fontWeight: '600',
  },
});

export default InsuranceProgressCard;
