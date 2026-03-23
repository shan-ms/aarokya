import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface BalanceCardProps {
  /** Balance in paise */
  balance: number;
  onAddMoney: () => void;
}

/** Format paise to rupees with comma separators: 150000 -> "1,500.00" */
const formatCurrency = (paise: number): string => {
  const rupees = paise / 100;
  const parts = rupees.toFixed(2).split('.');
  const intPart = parts[0];
  const decPart = parts[1];

  // Indian numbering: last 3 digits, then groups of 2
  let result = '';
  const len = intPart.length;
  if (len <= 3) {
    result = intPart;
  } else {
    result = intPart.slice(len - 3);
    let remaining = intPart.slice(0, len - 3);
    while (remaining.length > 2) {
      result = remaining.slice(remaining.length - 2) + ',' + result;
      remaining = remaining.slice(0, remaining.length - 2);
    }
    if (remaining.length > 0) {
      result = remaining + ',' + result;
    }
  }

  return result + '.' + decPart;
};

const BalanceCard: React.FC<BalanceCardProps> = ({ balance, onAddMoney }) => {
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <View style={styles.content}>
        <Text style={styles.label}>{t('home.hsa_balance')}</Text>
        <Text style={styles.balance}>
          <Text style={styles.currency}>₹</Text>
          {formatCurrency(balance)}
        </Text>
        <Button
          title={t('home.add_money')}
          onPress={onAddMoney}
          variant="primary"
          style={styles.button}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  content: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.bodyMedium,
    color: 'rgba(255,255,255,0.8)',
  },
  balance: {
    ...typography.displayLarge,
    color: colors.surface,
    marginTop: spacing.xs,
  },
  currency: {
    ...typography.displaySmall,
    color: colors.surface,
  },
  button: {
    backgroundColor: colors.surface,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});

export default BalanceCard;
export { formatCurrency };
