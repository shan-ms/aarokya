import React, { useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/common/Card';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type AuthStackParamList = {
  Welcome: undefined;
  PhoneInput: undefined;
  OTP: { phone: string };
  Intent: undefined;
  Consent: undefined;
  ABHALink: undefined;
  HealthProfileSetup: undefined;
};

type IntentScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Intent'>;

interface IntentScreenProps {
  navigation: IntentScreenNavigationProp;
}

interface IntentOption {
  key: string;
  icon: string;
  titleKey: string;
  subtitleKey: string;
  bgColor: string;
  accentColor: string;
}

const INTENT_OPTIONS: IntentOption[] = [
  {
    key: 'checkin',
    icon: '\uD83E\uDD12',
    titleKey: 'intent.not_feeling_well',
    subtitleKey: 'intent.not_feeling_well_desc',
    bgColor: colors.errorLight,
    accentColor: colors.error,
  },
  {
    key: 'book_care',
    icon: '\uD83D\uDCC5',
    titleKey: 'intent.book_care',
    subtitleKey: 'intent.book_care_desc',
    bgColor: colors.primaryLight,
    accentColor: colors.primary,
  },
  {
    key: 'records',
    icon: '\uD83D\uDCC1',
    titleKey: 'intent.store_records',
    subtitleKey: 'intent.store_records_desc',
    bgColor: colors.secondaryLight,
    accentColor: colors.secondary,
  },
  {
    key: 'save',
    icon: '\uD83D\uDCB0',
    titleKey: 'intent.save_health',
    subtitleKey: 'intent.save_health_desc',
    bgColor: colors.accentLight,
    accentColor: colors.accent,
  },
];

const IntentScreen: React.FC<IntentScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const setIntent = useAuthStore((state) => state.setIntent);

  const handleSelect = useCallback(
    (key: string) => {
      setIntent(key);
      navigation.navigate('Consent');
    },
    [setIntent, navigation],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>{t('intent.title')}</Text>
          <Text style={styles.subtitle}>{t('intent.subtitle')}</Text>
        </View>

        <View style={styles.optionsGrid}>
          {INTENT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              onPress={() => handleSelect(option.key)}
              activeOpacity={0.7}
              style={styles.optionTouchable}
            >
              <Card style={[styles.optionCard, { borderColor: option.accentColor }]}>
                <View style={[styles.iconContainer, { backgroundColor: option.bgColor }]}>
                  <Text style={styles.iconText}>{option.icon}</Text>
                </View>
                <Text style={styles.optionTitle}>{t(option.titleKey)}</Text>
                <Text style={styles.optionSubtitle}>{t(option.subtitleKey)}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  headerSection: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  optionTouchable: {
    width: '47%',
  },
  optionCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderWidth: 1.5,
    minHeight: 180,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 28,
  },
  optionTitle: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  optionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default IntentScreen;
