import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { StackNavigationProp } from '@react-navigation/stack';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { createHsa } from '../../api/hsa';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type AuthStackParamList = {
  Welcome: undefined;
  PhoneInput: undefined;
  OTP: { phone: string };
  ABHALink: undefined;
  HealthProfileSetup: undefined;
};

type ABHALinkScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'ABHALink'
>;

interface ABHALinkScreenProps {
  navigation: ABHALinkScreenNavigationProp;
}

const ABHA_REGEX = /^\d{2}-\d{4}-\d{4}-\d{4}$/;

const formatAbhaInput = (text: string): string => {
  const digits = text.replace(/[^0-9]/g, '').slice(0, 14);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 10));
  if (digits.length > 10) parts.push(digits.slice(10, 14));
  return parts.join('-');
};

const ABHALinkScreen: React.FC<ABHALinkScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const [abhaNumber, setAbhaNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = ABHA_REGEX.test(abhaNumber);

  const handleLink = async () => {
    if (!isValid) {
      setError(t('abha.invalid_format'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      await createHsa(abhaNumber);
      navigation.navigate('HealthProfileSetup');
    } catch (err: any) {
      const message = err?.response?.data?.message || t('common.error');
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.navigate('HealthProfileSetup');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('abha.title')}</Text>
          <Text style={styles.subtitle}>{t('abha.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <Input
            label={t('abha.label')}
            placeholder="XX-XXXX-XXXX-XXXX"
            value={abhaNumber}
            onChangeText={(text) => {
              setAbhaNumber(formatAbhaInput(text));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={17}
            error={error}
          />
          <Text style={styles.hint}>{t('abha.format_hint')}</Text>
        </View>

        <View style={styles.bottom}>
          <Button
            title={t('abha.link_button')}
            onPress={handleLink}
            loading={loading}
            disabled={!isValid}
          />
          <Button
            title={t('abha.skip')}
            onPress={handleSkip}
            variant="text"
            style={styles.skipButton}
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginTop: spacing.xxl,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  form: {
    marginTop: spacing.xl,
  },
  hint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  bottom: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
  skipButton: {
    marginTop: spacing.sm,
  },
});

export default ABHALinkScreen;
