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

interface BusinessDetailsScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
  route: {
    params: {
      phone: string;
      partnerType: PartnerType;
    };
  };
}

const BusinessDetailsScreen: React.FC<BusinessDetailsScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const { phone, partnerType } = route.params;
  const setPartner = useAuthStore((state) => state.setPartner);

  const [businessName, setBusinessName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [schemeType, setSchemeType] = useState<ContributionSchemeType>('per_task');
  const [amountText, setAmountText] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid =
    businessName.trim().length > 0 &&
    registrationNumber.trim().length > 0 &&
    amountText.length > 0 &&
    parseFloat(amountText) > 0;

  const handleRegister = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      const amountPaise = Math.round(parseFloat(amountText) * 100);
      const response = await registerPartner({
        phone,
        businessName: businessName.trim(),
        registrationNumber: registrationNumber.trim(),
        partnerType,
        contributionSchemeType: schemeType,
        contributionAmountPaise: amountPaise,
      });
      setPartner(response.data);
      // AppNavigator will redirect to main since partner is now set
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
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
            <Text style={styles.title}>{t('onboarding.businessDetailsTitle')}</Text>
            <Text style={styles.subtitle}>
              {t('onboarding.businessDetailsSubtitle')}
            </Text>
          </View>

          <Input
            label={t('onboarding.businessName')}
            placeholder={t('onboarding.businessNamePlaceholder')}
            value={businessName}
            onChangeText={setBusinessName}
            autoCapitalize="words"
          />

          <Input
            label={t('onboarding.registrationNumber')}
            placeholder={t('onboarding.registrationNumberPlaceholder')}
            value={registrationNumber}
            onChangeText={setRegistrationNumber}
            autoCapitalize="characters"
          />

          <Text style={styles.sectionLabel}>
            {t('onboarding.contributionScheme')}
          </Text>
          <View style={styles.schemeRow}>
            <TouchableOpacity
              style={[
                styles.schemeOption,
                schemeType === 'per_task' && styles.schemeOptionActive,
              ]}
              onPress={() => setSchemeType('per_task')}
            >
              <Text
                style={[
                  styles.schemeLabel,
                  schemeType === 'per_task' && styles.schemeLabelActive,
                ]}
              >
                {t('onboarding.perTask')}
              </Text>
              <Text style={styles.schemeDesc}>{t('onboarding.perTaskDesc')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.schemeOption,
                schemeType === 'monthly_fixed' && styles.schemeOptionActive,
              ]}
              onPress={() => setSchemeType('monthly_fixed')}
            >
              <Text
                style={[
                  styles.schemeLabel,
                  schemeType === 'monthly_fixed' && styles.schemeLabelActive,
                ]}
              >
                {t('onboarding.monthlyFixed')}
              </Text>
              <Text style={styles.schemeDesc}>{t('onboarding.monthlyFixedDesc')}</Text>
            </TouchableOpacity>
          </View>

          <Input
            label={t('onboarding.contributionAmount')}
            placeholder={t('onboarding.contributionAmountPlaceholder')}
            keyboardType="numeric"
            value={amountText}
            onChangeText={(text) => setAmountText(text.replace(/[^0-9.]/g, ''))}
            leftIcon={<Text style={styles.rupee}>{'\u20b9'}</Text>}
            hint={
              schemeType === 'per_task'
                ? 'Amount contributed per completed task'
                : 'Fixed monthly amount per worker'
            }
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('onboarding.register')}
            onPress={handleRegister}
            loading={loading}
            disabled={!isValid}
            size="lg"
            style={styles.button}
          />
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
    marginBottom: spacing.sm,
  },
  schemeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  schemeOption: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  schemeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  schemeLabel: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  schemeLabelActive: {
    color: colors.primary,
  },
  schemeDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  rupee: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
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

export default BusinessDetailsScreen;
