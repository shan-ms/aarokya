import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { StackNavigationProp } from '@react-navigation/stack';
import { useMutation } from '@tanstack/react-query';
import Button from '../../components/common/Button';
import { grantConsent } from '../../api/consent';
import { useAuthStore } from '../../store/authStore';
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

type ConsentScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Consent'>;

interface ConsentScreenProps {
  navigation: ConsentScreenNavigationProp;
}

const CONSENT_BULLETS = [
  'consent.bullet_healthcare',
  'consent.bullet_records',
  'consent.bullet_savings',
];

const ConsentScreen: React.FC<ConsentScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);
  const setConsented = useAuthStore((state) => state.setConsented);

  const consentMutation = useMutation({
    mutationFn: () => grantConsent('health_data_processing'),
    onSuccess: () => {
      setConsented(true);
      navigation.navigate('ABHALink');
    },
    onError: () => {
      Alert.alert(t('common.error'), t('consent.submit_error'));
    },
  });

  const handleContinue = useCallback(() => {
    if (!agreed) return;
    consentMutation.mutate();
  }, [agreed, consentMutation]);

  const handleToggle = useCallback(() => {
    setAgreed((prev) => !prev);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <View style={styles.shieldIcon}>
            <Text style={styles.shieldIconText}>S</Text>
          </View>
          <Text style={styles.title}>{t('consent.title')}</Text>
          <Text style={styles.subtitle}>{t('consent.subtitle')}</Text>
        </View>

        <View style={styles.explanationSection}>
          <Text style={styles.explanationHeader}>{t('consent.we_use_info')}</Text>
          {CONSENT_BULLETS.map((bulletKey, index) => (
            <View key={index} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{t(bulletKey)}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={handleToggle}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Text style={styles.checkmark}>{'✓'}</Text>}
          </View>
          <Text style={styles.checkboxLabel}>{t('consent.agree_text')}</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.7} style={styles.privacyLinkContainer}>
          <Text style={styles.privacyLink}>{t('consent.read_privacy_policy')}</Text>
        </TouchableOpacity>

        <Text style={styles.withdrawNote}>{t('consent.withdraw_note')}</Text>
      </ScrollView>

      <View style={styles.bottomSection}>
        <Button
          title={t('consent.continue')}
          onPress={handleContinue}
          variant="primary"
          loading={consentMutation.isPending}
          disabled={!agreed}
          style={styles.continueButton}
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  shieldIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  shieldIconText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.secondary,
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
  explanationSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  explanationHeader: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  bulletText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  privacyLinkContainer: {
    marginBottom: spacing.md,
  },
  privacyLink: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  withdrawNote: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  bottomSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  continueButton: {
    width: '100%',
  },
});

export default ConsentScreen;
