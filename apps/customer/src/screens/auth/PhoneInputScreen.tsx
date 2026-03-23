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
import { sendOtp } from '../../api/auth';
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

type PhoneInputScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'PhoneInput'
>;

interface PhoneInputScreenProps {
  navigation: PhoneInputScreenNavigationProp;
}

const PhoneInputScreen: React.FC<PhoneInputScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidPhone = /^[6-9]\d{9}$/.test(phone);

  const handleSendOtp = async () => {
    if (!isValidPhone) {
      setError(t('auth.invalid_phone'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      await sendOtp(`+91${phone}`);
      navigation.navigate('OTP', { phone: `+91${phone}` });
    } catch (err: any) {
      const message =
        err?.response?.data?.message || t('common.error');
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.phone_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.phone_subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <Input
            label={undefined}
            placeholder={t('auth.phone_placeholder')}
            value={phone}
            onChangeText={(text) => {
              setPhone(text.replace(/[^0-9]/g, '').slice(0, 10));
              setError('');
            }}
            keyboardType="phone-pad"
            maxLength={10}
            error={error}
            leftIcon={
              <Text style={styles.prefix}>+91</Text>
            }
          />
        </View>

        <View style={styles.bottom}>
          <Button
            title={t('auth.send_otp')}
            onPress={handleSendOtp}
            loading={loading}
            disabled={phone.length < 10}
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
  prefix: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  bottom: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
});

export default PhoneInputScreen;
