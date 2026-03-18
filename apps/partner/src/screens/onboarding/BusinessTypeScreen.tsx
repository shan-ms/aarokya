import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { PartnerType } from '../../types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import Button from '../../components/common/Button';

interface BusinessTypeScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
  route: {
    params: {
      phone: string;
    };
  };
}

interface TypeOption {
  key: PartnerType;
  labelKey: string;
  descKey: string;
  emoji: string;
}

const PARTNER_TYPES: TypeOption[] = [
  {
    key: 'gig_platform',
    labelKey: 'onboarding.gigPlatform',
    descKey: 'onboarding.gigPlatformDesc',
    emoji: '',
  },
  {
    key: 'household_employer',
    labelKey: 'onboarding.householdEmployer',
    descKey: 'onboarding.householdEmployerDesc',
    emoji: '',
  },
  {
    key: 'corporate_employer',
    labelKey: 'onboarding.corporateEmployer',
    descKey: 'onboarding.corporateEmployerDesc',
    emoji: '',
  },
  {
    key: 'csr_program',
    labelKey: 'onboarding.csrProgram',
    descKey: 'onboarding.csrProgramDesc',
    emoji: '',
  },
  {
    key: 'ngo',
    labelKey: 'onboarding.ngo',
    descKey: 'onboarding.ngoDesc',
    emoji: '',
  },
];

const BusinessTypeScreen: React.FC<BusinessTypeScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<PartnerType | null>(null);

  const handleNext = () => {
    if (!selectedType) return;
    navigation.navigate('BusinessDetails', {
      phone: route.params.phone,
      partnerType: selectedType,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('onboarding.businessTypeTitle')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.businessTypeSubtitle')}</Text>
        </View>

        <View style={styles.optionsList}>
          {PARTNER_TYPES.map((option) => {
            const isSelected = selectedType === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => setSelectedType(option.key)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionTextContainer}>
                    <Text
                      style={[
                        styles.optionLabel,
                        isSelected && styles.optionLabelSelected,
                      ]}
                    >
                      {t(option.labelKey)}
                    </Text>
                    <Text style={styles.optionDesc}>{t(option.descKey)}</Text>
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
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t('common.next')}
          onPress={handleNext}
          disabled={!selectedType}
          size="lg"
          style={styles.button}
        />
      </View>
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
    padding: spacing.xxl,
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
  optionsList: {
    gap: spacing.md,
  },
  optionCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  optionDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
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

export default BusinessTypeScreen;
