import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { PartnerType, ContributionSchemeType } from '../../types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { registerPartner } from '../../api/partner';
import { useAuthStore } from '../../store/authStore';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';

interface ContributionSchemeScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
  route: {
    params: {
      phone: string;
      partnerType: PartnerType;
      businessName: string;
      registrationNumber: string;
    };
  };
}

type SchemeOption = 'fixed_monthly' | 'percentage_wage' | 'one_time';

interface SchemeConfig {
  key: SchemeOption;
  labelKey: string;
  descKey: string;
  inputLabelKey: string;
  inputPlaceholderKey: string;
  suffix: string;
}

const SCHEME_OPTIONS: SchemeConfig[] = [
  {
    key: 'fixed_monthly',
    labelKey: 'contributionScheme.fixedMonthly',
    descKey: 'contributionScheme.fixedMonthlyDesc',
    inputLabelKey: 'contributionScheme.monthlyAmount',
    inputPlaceholderKey: 'contributionScheme.amountPlaceholder',
    suffix: '/ month',
  },
  {
    key: 'percentage_wage',
    labelKey: 'contributionScheme.percentageWage',
    descKey: 'contributionScheme.percentageWageDesc',
    inputLabelKey: 'contributionScheme.percentage',
    inputPlaceholderKey: 'contributionScheme.percentagePlaceholder',
    suffix: '%',
  },
  {
    key: 'one_time',
    labelKey: 'contributionScheme.oneTime',
    descKey: 'contributionScheme.oneTimeDesc',
    inputLabelKey: 'contributionScheme.oneTimeAmount',
    inputPlaceholderKey: 'contributionScheme.amountPlaceholder',
    suffix: '',
  },
];

const ContributionSchemeScreen: React.FC<ContributionSchemeScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const { phone, partnerType, businessName, registrationNumber } = route.params;
  const setPartner = useAuthStore((state) => state.setPartner);

  const [selectedScheme, setSelectedScheme] = useState<SchemeOption | null>(null);
  const [amountText, setAmountText] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const selectedConfig = SCHEME_OPTIONS.find((s) => s.key === selectedScheme);

  const isValidAmount = (() => {
    const value = parseFloat(amountText);
    if (isNaN(value) || value <= 0) return false;
    if (selectedScheme === 'percentage_wage' && value > 100) return false;
    return true;
  })();

  const canConfirm = selectedScheme !== null && isValidAmount;

  const handleConfirm = () => {
    if (!canConfirm) return;
    setConfirmed(true);
  };

  const handleRegister = async () => {
    if (!canConfirm) return;

    setLoading(true);
    try {
      const schemeType: ContributionSchemeType =
        selectedScheme === 'fixed_monthly' ? 'monthly_fixed' : 'per_task';
      const amountPaise =
        selectedScheme === 'percentage_wage'
          ? Math.round(parseFloat(amountText) * 100)
          : Math.round(parseFloat(amountText) * 100);

      const response = await registerPartner({
        phone,
        businessName,
        registrationNumber,
        partnerType,
        contributionSchemeType: schemeType,
        contributionAmountPaise: amountPaise,
      });
      setPartner(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  const getFormattedValue = (): string => {
    if (!amountText || !selectedScheme) return '';
    const value = parseFloat(amountText);
    if (isNaN(value)) return '';
    if (selectedScheme === 'percentage_wage') {
      return `${value}% of wage`;
    }
    return `\u20b9${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${selectedConfig?.suffix ? ` ${selectedConfig.suffix}` : ''}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              {t('contributionScheme.title')}
            </Text>
            <Text style={styles.subtitle}>
              {t('contributionScheme.subtitle')}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>
            {t('contributionScheme.chooseScheme')}
          </Text>

          <View style={styles.schemeList}>
            {SCHEME_OPTIONS.map((option) => {
              const isSelected = selectedScheme === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.schemeCard,
                    isSelected && styles.schemeCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedScheme(option.key);
                    setAmountText('');
                    setConfirmed(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.schemeContent}>
                    <View style={styles.schemeTextContainer}>
                      <Text
                        style={[
                          styles.schemeLabel,
                          isSelected && styles.schemeLabelSelected,
                        ]}
                      >
                        {t(option.labelKey)}
                      </Text>
                      <Text style={styles.schemeDesc}>{t(option.descKey)}</Text>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedScheme && selectedConfig && (
            <View style={styles.amountSection}>
              <Input
                label={t(selectedConfig.inputLabelKey)}
                placeholder={t(selectedConfig.inputPlaceholderKey)}
                keyboardType="numeric"
                value={amountText}
                onChangeText={(text) => {
                  setAmountText(text.replace(/[^0-9.]/g, ''));
                  setConfirmed(false);
                }}
                leftIcon={
                  selectedScheme !== 'percentage_wage' ? (
                    <Text style={styles.rupee}>{'\u20b9'}</Text>
                  ) : undefined
                }
                hint={
                  selectedScheme === 'percentage_wage'
                    ? t('contributionScheme.percentageHint')
                    : undefined
                }
              />
            </View>
          )}

          {confirmed && canConfirm && (
            <Card style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>
                {t('contributionScheme.confirmationTitle')}
              </Text>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>
                  {t('contributionScheme.schemeType')}
                </Text>
                <Text style={styles.confirmValue}>
                  {selectedConfig ? t(selectedConfig.labelKey) : ''}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>
                  {t('contributionScheme.amount')}
                </Text>
                <Text style={styles.confirmValue}>{getFormattedValue()}</Text>
              </View>
              <View style={styles.confirmDivider} />
              <Text style={styles.confirmNote}>
                {t('contributionScheme.confirmNote')}
              </Text>
            </Card>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {!confirmed ? (
            <Button
              title={t('common.confirm')}
              onPress={handleConfirm}
              disabled={!canConfirm}
              size="lg"
              style={styles.button}
            />
          ) : (
            <Button
              title={t('contributionScheme.completeRegistration')}
              onPress={handleRegister}
              loading={loading}
              size="lg"
              style={styles.button}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xxl,
    paddingBottom: spacing.huge,
  },
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  schemeList: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  schemeCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  schemeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  schemeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schemeTextContainer: {
    flex: 1,
  },
  schemeLabel: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  schemeLabelSelected: {
    color: colors.primary,
  },
  schemeDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  amountSection: {
    marginBottom: spacing.lg,
  },
  rupee: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  confirmCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.secondaryLight,
  },
  confirmTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  confirmLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  confirmValue: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  confirmNote: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    padding: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  button: {
    width: '100%',
  },
});

export default ContributionSchemeScreen;
