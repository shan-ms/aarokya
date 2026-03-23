import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import Card from '../common/Card';

interface DashboardMetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
  onPress?: () => void;
}

const DashboardMetricCard: React.FC<DashboardMetricCardProps> = ({
  icon,
  label,
  value,
  trend,
  trendPositive,
  onPress,
}) => {
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {trend && (
        <View style={styles.trendContainer}>
          <Text
            style={[
              styles.trendText,
              { color: trendPositive ? colors.success : colors.error },
            ]}
          >
            {trendPositive ? '+' : ''}
            {trend}
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: spacing.lg,
    minWidth: 100,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
  },
  trendContainer: {
    marginTop: spacing.xs,
  },
  trendText: {
    ...typography.caption,
    fontWeight: '600',
  },
});

export default DashboardMetricCard;
