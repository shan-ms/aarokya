import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { typography, fontSizes } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { verifyOtp, sendOtp } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/common/Button';

interface OTPScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
  route: {
    params: {
      phone: string;
      requestId: string;
    };
  };
}

const OTP_LENGTH = 6;

const OTPScreen: React.FC<OTPScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { phone, requestId: initialRequestId } = route.params;
  const login = useAuthStore((state) => state.login);

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState(initialRequestId);
  const [resendTimer, setResendTimer] = useState(30);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      Alert.alert(t('common.error'), t('auth.invalidOtp'));
      return;
    }

    setLoading(true);
    try {
      const response = await verifyOtp(phone, otp, requestId);
      const { accessToken, refreshToken, isNewPartner, partnerId } = response.data;
      login({
        token: accessToken,
        refreshToken,
        isNewPartner,
        partner: partnerId ? undefined : undefined,
      });

      if (isNewPartner) {
        navigation.navigate('BusinessType', { phone });
      }
      // If not new, AppNavigator will handle redirect to main
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const response = await sendOtp(phone);
      setRequestId(response.data.requestId);
      setResendTimer(30);
      setOtp('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend OTP';
      Alert.alert(t('common.error'), message);
    }
  };

  const renderOtpBoxes = () => {
    const boxes = [];
    for (let i = 0; i < OTP_LENGTH; i++) {
      const isFilled = i < otp.length;
      const isActive = i === otp.length;
      boxes.push(
        <View
          key={i}
          style={[
            styles.otpBox,
            isFilled && styles.otpBoxFilled,
            isActive && styles.otpBoxActive,
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.otpTitle')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.otpSubtitle')} {phone}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.otpContainer}
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
          >
            {renderOtpBoxes()}
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH))}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoFocus
          />

          <View style={styles.resendContainer}>
            {resendTimer > 0 ? (
              <Text style={styles.resendTimerText}>
                {t('auth.resendIn', { seconds: resendTimer })}
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend}>
                <Text style={styles.resendText}>{t('auth.resendOtp')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <Button
              title={t('auth.verify')}
              onPress={handleVerify}
              loading={loading}
              disabled={otp.length !== OTP_LENGTH}
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  otpBoxActive: {
    borderColor: colors.primary,
  },
  otpDigit: {
    fontSize: fontSizes.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  resendTimerText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
  },
  resendText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.primary,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  button: {
    width: '100%',
  },
});

export default OTPScreen;
