import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import Button from '../../components/common/Button';
import { verifyOtp, sendOtp } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography, fontSizes } from '../../theme/typography';

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneInput: undefined;
  OTP: { phone: string };
  ABHALink: undefined;
  HealthProfileSetup: undefined;
};

type OTPScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'OTP'>;
type OTPScreenRouteProp = RouteProp<AuthStackParamList, 'OTP'>;

interface OTPScreenProps {
  navigation: OTPScreenNavigationProp;
  route: OTPScreenRouteProp;
}

const OTP_LENGTH = 6;
const RESEND_TIMER = 30;

const OTPScreen: React.FC<OTPScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { phone } = route.params;
  const login = useAuthStore((state) => state.login);

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(RESEND_TIMER);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      setError(t('auth.invalid_otp'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await verifyOtp(phone, otp);
      const { token, refreshToken, user } = response.data;
      login(token, refreshToken, user);
      // After login, the AppNavigator will check isAuthenticated.
      // If it's a new user (no abhaId), navigate to ABHA link.
      // For now, we navigate to ABHALink as part of onboarding.
      navigation.navigate('ABHALink');
    } catch (err: any) {
      const message =
        err?.response?.data?.message || t('common.error');
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await sendOtp(phone);
      setTimer(RESEND_TIMER);
      setOtp('');
    } catch (err: any) {
      Alert.alert(t('common.error'), t('common.error'));
    }
  };

  const renderOtpBoxes = () => {
    const boxes = [];
    for (let i = 0; i < OTP_LENGTH; i++) {
      boxes.push(
        <View
          key={i}
          style={[
            styles.otpBox,
            otp.length === i && styles.otpBoxActive,
            error ? styles.otpBoxError : null,
          ]}
        >
          <Text style={styles.otpDigit}>{otp[i] || ''}</Text>
        </View>,
      );
    }
    return boxes;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.otp_title')}</Text>
          <Text style={styles.subtitle}>
            {t('auth.otp_subtitle')} {phone}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={1}
          style={styles.otpContainer}
          onPress={() => inputRef.current?.focus()}
        >
          {renderOtpBoxes()}
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={otp}
          onChangeText={(text) => {
            const cleaned = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
            setOtp(cleaned);
            setError('');
          }}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.resendContainer}>
          {timer > 0 ? (
            <Text style={styles.timerText}>
              {t('auth.resend_in', { seconds: timer })}
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendText}>{t('auth.resend_otp')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottom}>
          <Button
            title={t('auth.verify')}
            onPress={handleVerify}
            loading={loading}
            disabled={otp.length !== OTP_LENGTH}
          />
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  otpBoxActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  otpBoxError: {
    borderColor: colors.error,
  },
  otpDigit: {
    fontSize: fontSizes.xxl,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  timerText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
  },
  resendText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  bottom: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
});

export default OTPScreen;
