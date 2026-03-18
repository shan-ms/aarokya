import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { createContribution } from '../api/contributions';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

const PRESET_AMOUNTS = [50, 100, 200, 500];

const ContributeScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: (amountPaise: number) =>
      createContribution({
        amount: amountPaise,
        source: 'self',
        paymentMethod: 'upi',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
      Alert.alert(t('contribute.success'), '', [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
    },
    onError: () => {
      Alert.alert(t('common.error'), t('contribute.failed'));
    },
  });

  const handlePresetSelect = (value: number) => {
    setSelectedPreset(value);
    setAmount(String(value));
  };

  const handleCustomAmount = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setAmount(cleaned);
    setSelectedPreset(null);
  };

  const handlePayment = () => {
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum < 10) {
      Alert.alert(t('common.error'), t('contribute.min_amount'));
      return;
    }
    // Convert rupees to paise
    mutation.mutate(amountNum * 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>{t('contribute.title')}</Text>
        <Text style={styles.subtitle}>{t('contribute.subtitle')}</Text>

        <View style={styles.presetGrid}>
          {PRESET_AMOUNTS.map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[
                styles.presetButton,
                selectedPreset === preset && styles.presetButtonActive,
              ]}
              onPress={() => handlePresetSelect(preset)}
            >
              <Text
                style={[
                  styles.presetText,
                  selectedPreset === preset && styles.presetTextActive,
                ]}
              >
                ₹{preset}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card style={styles.customCard}>
          <Text style={styles.customLabel}>{t('contribute.custom_amount')}</Text>
          <Input
            placeholder={t('contribute.amount_placeholder')}
            value={amount}
            onChangeText={handleCustomAmount}
            keyboardType="number-pad"
            leftIcon={<Text style={styles.rupeeSymbol}>₹</Text>}
            containerStyle={styles.inputContainer}
          />
        </Card>

        <View style={styles.bottom}>
          <Button
            title={t('contribute.pay_via_upi')}
            onPress={handlePayment}
            loading={mutation.isPending}
            disabled={!amount || parseInt(amount, 10) < 10}
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
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
    paddingTop: spacing.md,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  presetGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  presetButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  presetButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  presetText: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  presetTextActive: {
    color: colors.primary,
  },
  customCard: {
    marginTop: spacing.lg,
  },
  customLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    marginBottom: 0,
  },
  rupeeSymbol: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  bottom: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
});

export default ContributeScreen;
