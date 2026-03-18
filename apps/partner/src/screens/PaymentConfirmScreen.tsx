import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ContributionSourceType } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { createContribution, bulkContribute } from '../api/contributions';
import { useAuthStore } from '../store/authStore';
import { usePartnerStore } from '../store/partnerStore';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

interface PaymentConfirmScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    popToTop: () => void;
  };
  route: {
    params: {
      workerIds: string[];
      amountPerWorkerPaise: number;
      sourceType: ContributionSourceType;
      mode: 'individual' | 'bulk';
    };
  };
}

const formatCurrency = (paise: number): string => {
  const rupees = paise / 100;
  return `\u20b9${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const PaymentConfirmScreen: React.FC<PaymentConfirmScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const { workerIds, amountPerWorkerPaise, sourceType, mode } = route.params;
  const partner = useAuthStore((state) => state.partner);
  const { workers, fetchDashboard } = usePartnerStore();

  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const totalAmountPaise = workerIds.length * amountPerWorkerPaise;

  const selectedWorkers = useMemo(
    () => workers.filter((w) => workerIds.includes(w.id)),
    [workers, workerIds],
  );

  const handlePayPress = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmPay = async () => {
    setShowConfirmModal(false);
    if (!partner?.id) return;

    setLoading(true);
    try {
      if (mode === 'individual' && workerIds.length === 1) {
        await createContribution(partner.id, {
          workerId: workerIds[0],
          amountPaise: amountPerWorkerPaise,
          sourceType,
        });
      } else {
        await bulkContribute(partner.id, {
          workerIds,
          amountPerWorkerPaise,
          sourceType,
        });
      }

      fetchDashboard(partner.id);

      Alert.alert(t('payment.success'), '', [
        {
          text: t('common.done'),
          onPress: () => navigation.popToTop(),
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('payment.failed');
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('payment.title')}</Text>

        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('payment.summary')}</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('payment.workersCount')}</Text>
            <Text style={styles.summaryValue}>{workerIds.length}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {t('contribute.amountPerWorker')}
            </Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(amountPerWorkerPaise)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('contribute.sourceType')}</Text>
            <Text style={styles.summaryValue}>
              {sourceType.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>{t('payment.totalAmount')}</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalAmountPaise)}</Text>
          </View>
        </Card>

        {selectedWorkers.length > 0 && (
          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownTitle}>{t('payment.breakdown')}</Text>
            {selectedWorkers.map((worker) => (
              <View key={worker.id} style={styles.breakdownRow}>
                <View style={styles.breakdownWorker}>
                  <View style={styles.miniAvatar}>
                    <Text style={styles.miniAvatarText}>
                      {worker.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.breakdownName} numberOfLines={1}>
                    {worker.name}
                  </Text>
                </View>
                <Text style={styles.breakdownAmount}>
                  {formatCurrency(amountPerWorkerPaise)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={loading ? t('payment.processing') : t('payment.payViaUpi')}
          onPress={handlePayPress}
          loading={loading}
          size="lg"
          style={styles.payButton}
        />
      </View>

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('payment.confirmTitle')}</Text>
            <Text style={styles.modalMessage}>
              {t('payment.confirmMessage', {
                amount: formatCurrency(totalAmountPaise),
                count: workerIds.length,
              })}
            </Text>

            <View style={styles.modalAmountContainer}>
              <Text style={styles.modalAmount}>
                {formatCurrency(totalAmountPaise)}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <View style={styles.modalActionGap} />
              <Button
                title={t('payment.confirmPay')}
                onPress={handleConfirmPay}
                size="md"
                style={styles.modalConfirmButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: spacing.huge,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginBottom: spacing.xxl,
  },
  summaryCard: {
    marginBottom: spacing.xxl,
  },
  summaryTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
  totalLabel: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  totalValue: {
    ...typography.headlineLarge,
    color: colors.primary,
  },
  breakdownSection: {
    marginBottom: spacing.xxl,
  },
  breakdownTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  breakdownWorker: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  miniAvatarText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.primary,
  },
  breakdownName: {
    ...typography.bodyMedium,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  breakdownAmount: {
    ...typography.bodyMedium,
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
  payButton: {
    width: '100%',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
  },
  modalTitle: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalMessage: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  modalAmountContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.xxl,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
  },
  modalAmount: {
    ...typography.displaySmall,
    color: colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  modalCancelText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  modalActionGap: {
    width: spacing.md,
  },
  modalConfirmButton: {
    flex: 1,
  },
});

export default PaymentConfirmScreen;
