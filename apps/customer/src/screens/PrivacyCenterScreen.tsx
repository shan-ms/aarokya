import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  listConsents,
  withdrawConsent,
  grantConsent,
  exportUserData,
  deleteAccount,
} from '../api/consent';
import { listShared } from '../api/documents';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { ConsentRecord, RecordShare } from '../types';

const CONSENT_PURPOSES = [
  {
    purpose: 'health_data_processing',
    titleKey: 'privacy.consent_health_data_title',
    descriptionKey: 'privacy.consent_health_data_desc',
  },
  {
    purpose: 'record_sharing',
    titleKey: 'privacy.consent_sharing_title',
    descriptionKey: 'privacy.consent_sharing_desc',
  },
  {
    purpose: 'analytics',
    titleKey: 'privacy.consent_analytics_title',
    descriptionKey: 'privacy.consent_analytics_desc',
  },
];

const PrivacyCenterScreen: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);

  const {
    data: consentsData,
    isLoading: consentsLoading,
    refetch: refetchConsents,
    isRefetching,
  } = useQuery<{ data: ConsentRecord[] }>({
    queryKey: ['consents'],
    queryFn: listConsents,
  });

  const { data: sharedData, isLoading: sharedLoading } = useQuery<{ data: RecordShare[] }>({
    queryKey: ['documents-shared'],
    queryFn: listShared,
  });

  const withdrawMutation = useMutation({
    mutationFn: (purpose: string) => withdrawConsent(purpose),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consents'] });
    },
    onError: () => {
      Alert.alert(t('common.error'), t('privacy.withdraw_error'));
    },
  });

  const grantMutation = useMutation({
    mutationFn: (purpose: string) => grantConsent(purpose),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consents'] });
    },
    onError: () => {
      Alert.alert(t('common.error'), t('privacy.grant_error'));
    },
  });

  const exportMutation = useMutation({
    mutationFn: exportUserData,
    onSuccess: () => {
      Alert.alert(t('privacy.export_success_title'), t('privacy.export_success_message'));
    },
    onError: () => {
      Alert.alert(t('common.error'), t('privacy.export_error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      logout();
    },
    onError: () => {
      Alert.alert(t('common.error'), t('privacy.delete_error'));
    },
  });

  const consents = consentsData?.data ?? [];
  const sharingHistory = sharedData?.data ?? [];

  const isConsentActive = useCallback(
    (purpose: string): boolean => {
      return consents.some((c) => c.purpose === purpose && !c.withdrawnAt);
    },
    [consents],
  );

  const handleToggleConsent = useCallback(
    (purpose: string, currentlyActive: boolean) => {
      if (currentlyActive) {
        Alert.alert(
          t('privacy.withdraw_confirm_title'),
          t('privacy.withdraw_confirm_message'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('privacy.withdraw'),
              style: 'destructive',
              onPress: () => withdrawMutation.mutate(purpose),
            },
          ],
        );
      } else {
        grantMutation.mutate(purpose);
      }
    },
    [withdrawMutation, grantMutation, t],
  );

  const handleExportData = useCallback(() => {
    exportMutation.mutate();
  }, [exportMutation]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t('privacy.delete_confirm_title'),
      t('privacy.delete_confirm_message_1'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('privacy.delete_continue'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('privacy.delete_final_title'),
              t('privacy.delete_final_message'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('privacy.delete_account'),
                  style: 'destructive',
                  onPress: () => deleteMutation.mutate(),
                },
              ],
            );
          },
        },
      ],
    );
  }, [deleteMutation, t]);

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  if (consentsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetchConsents}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerSection}>
          <Text style={styles.title}>{t('privacy.title')}</Text>
          <Text style={styles.trustStatement}>{t('privacy.trust_statement')}</Text>
        </View>

        {/* Consents Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.your_consents')}</Text>
          <Text style={styles.sectionDescription}>{t('privacy.consents_description')}</Text>

          {CONSENT_PURPOSES.map((item) => {
            const active = isConsentActive(item.purpose);
            return (
              <Card key={item.purpose} style={styles.consentCard}>
                <View style={styles.consentRow}>
                  <View style={styles.consentInfo}>
                    <Text style={styles.consentTitle}>{t(item.titleKey)}</Text>
                    <Text style={styles.consentDescription}>{t(item.descriptionKey)}</Text>
                  </View>
                  <Switch
                    value={active}
                    onValueChange={() => handleToggleConsent(item.purpose, active)}
                    trackColor={{ false: colors.border, true: colors.secondaryLight }}
                    thumbColor={active ? colors.secondary : colors.textTertiary}
                    disabled={withdrawMutation.isPending || grantMutation.isPending}
                  />
                </View>
              </Card>
            );
          })}
        </View>

        {/* Sharing History Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sharing_history')}</Text>
          <Text style={styles.sectionDescription}>{t('privacy.sharing_description')}</Text>

          {sharingHistory.length === 0 ? (
            <Card style={styles.emptyShareCard}>
              <Text style={styles.emptyShareText}>{t('privacy.no_sharing_history')}</Text>
            </Card>
          ) : (
            sharingHistory.map((share) => (
              <Card key={share.id} style={styles.shareCard}>
                <Text style={styles.shareWith}>{share.sharedWith}</Text>
                {share.purpose && (
                  <Text style={styles.sharePurpose}>{share.purpose}</Text>
                )}
                <Text style={styles.shareDate}>
                  {t('privacy.shared_on', { date: formatDate(share.sharedAt) })}
                </Text>
                {share.expiresAt && (
                  <Text style={styles.shareExpiry}>
                    {t('privacy.expires_on', { date: formatDate(share.expiresAt) })}
                  </Text>
                )}
                {share.revokedAt && (
                  <Text style={styles.shareRevoked}>{t('privacy.revoked')}</Text>
                )}
              </Card>
            ))
          )}
        </View>

        {/* Data Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.your_data')}</Text>

          <Card style={styles.actionCard}>
            <Text style={styles.actionTitle}>{t('privacy.download_title')}</Text>
            <Text style={styles.actionDescription}>{t('privacy.download_description')}</Text>
            <Button
              title={t('privacy.download_data')}
              onPress={handleExportData}
              variant="outline"
              loading={exportMutation.isPending}
              style={styles.actionButton}
            />
          </Card>

          <Card style={styles.dangerCard}>
            <Text style={styles.dangerTitle}>{t('privacy.delete_title')}</Text>
            <Text style={styles.dangerDescription}>{t('privacy.delete_description')}</Text>
            <Button
              title={t('privacy.delete_account')}
              onPress={handleDeleteAccount}
              variant="outline"
              loading={deleteMutation.isPending}
              style={styles.dangerButton}
              textStyle={styles.dangerButtonText}
            />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  headerSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
  },
  trustStatement: {
    ...typography.bodyLarge,
    color: colors.secondary,
    fontWeight: '500',
    marginTop: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  consentCard: {
    marginBottom: spacing.sm,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  consentInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  consentTitle: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  consentDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyShareCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyShareText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
  },
  shareCard: {
    marginBottom: spacing.sm,
  },
  shareWith: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  sharePurpose: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  shareDate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  shareExpiry: {
    ...typography.bodySmall,
    color: colors.accent,
    marginTop: 2,
  },
  shareRevoked: {
    ...typography.label,
    color: colors.error,
    marginTop: spacing.xs,
  },
  actionCard: {
    marginBottom: spacing.md,
  },
  actionTitle: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  actionDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actionButton: {
    marginTop: spacing.md,
  },
  dangerCard: {
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.errorLight,
  },
  dangerTitle: {
    ...typography.bodyLarge,
    color: colors.error,
    fontWeight: '600',
  },
  dangerDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  dangerButton: {
    marginTop: spacing.md,
    borderColor: colors.error,
  },
  dangerButtonText: {
    color: colors.error,
  },
});

export default PrivacyCenterScreen;
