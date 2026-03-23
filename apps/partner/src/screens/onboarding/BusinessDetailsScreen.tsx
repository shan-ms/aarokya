import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { PartnerType } from '../../types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

interface BusinessDetailsScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
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

  const [businessName, setBusinessName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

  const isValid =
    businessName.trim().length > 0 &&
    registrationNumber.trim().length > 0;

  const handleNext = () => {
    if (!isValid) return;
    navigation.navigate('Verification', {
      phone,
      partnerType,
      businessName: businessName.trim(),
      registrationNumber: registrationNumber.trim(),
    });
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
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('common.next')}
            onPress={handleNext}
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
