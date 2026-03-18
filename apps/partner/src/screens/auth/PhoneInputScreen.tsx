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
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { sendOtp } from '../../api/auth';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

interface PhoneInputScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

const PhoneInputScreen: React.FC<PhoneInputScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidPhone = /^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''));

  const handleSendOtp = async () => {
    if (!isValidPhone) {
      setError(t('auth.invalidPhone'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const fullPhone = `+91${phone.replace(/\s/g, '')}`;
      const response = await sendOtp(fullPhone);
      navigation.navigate('OTP', {
        phone: fullPhone,
        requestId: response.data.requestId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP';
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.phoneTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.phoneSubtitle')}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Phone Number"
              placeholder={t('auth.phonePlaceholder')}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => {
                setPhone(text.replace(/[^0-9]/g, '').slice(0, 10));
                setError(null);
              }}
              error={error ?? undefined}
              leftIcon={<Text style={styles.prefix}>+91</Text>}
              maxLength={10}
              autoFocus
            />
          </View>

          <View style={styles.footer}>
            <Button
              title={t('auth.sendOtp')}
              onPress={handleSendOtp}
              loading={loading}
              disabled={!isValidPhone}
              size="lg"
              style={styles.button}
            />
          </View>
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
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.xxl,
  },
  header: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.xxxl,
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
  form: {
    flex: 1,
  },
  prefix: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  footer: {
    paddingTop: spacing.lg,
  },
  button: {
    width: '100%',
  },
});

export default PhoneInputScreen;
