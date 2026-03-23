import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface QuickAction {
  key: string;
  labelKey: string;
  icon: string;
  color: string;
  bgColor: string;
}

const actions: QuickAction[] = [
  {
    key: 'contribute',
    labelKey: 'quick_actions.contribute',
    icon: '+',
    color: colors.primary,
    bgColor: colors.primaryLight,
  },
  {
    key: 'insurance',
    labelKey: 'quick_actions.insurance',
    icon: '♥',
    color: colors.secondary,
    bgColor: colors.secondaryLight,
  },
  {
    key: 'health_records',
    labelKey: 'quick_actions.health_records',
    icon: '✦',
    color: colors.accent,
    bgColor: colors.accentLight,
  },
  {
    key: 'help',
    labelKey: 'quick_actions.help',
    icon: '?',
    color: colors.info,
    bgColor: '#DBEAFE',
  },
];

interface QuickActionsProps {
  onAction: (key: string) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.key}
          style={styles.actionItem}
          onPress={() => onAction(action.key)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: action.bgColor },
            ]}
          >
            <Text style={[styles.icon, { color: action.color }]}>
              {action.icon}
            </Text>
          </View>
          <Text style={styles.label} numberOfLines={2}>
            {t(action.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  actionItem: {
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default QuickActions;
