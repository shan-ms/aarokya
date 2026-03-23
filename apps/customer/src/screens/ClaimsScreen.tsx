import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { getClaims, submitClaim, getPolicies } from '../api/insurance';
import { formatCurrency } from '../components/home/BalanceCard';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Claim, ClaimStatus, Policy, ApiResponse, PaginatedResponse } from '../types';

const statusColors: Record<ClaimStatus, { bg: string; text: string }> = {
  submitted: { bg: colors.primaryLight, text: colors.primary },
  under_review: { bg: colors.accentLight, text: colors.accent },
  approved: { bg: colors.secondaryLight, text: colors.secondary },
  rejected: { bg: colors.errorLight, text: colors.error },
  paid: { bg: colors.secondaryLight, text: colors.secondary },
};

const ClaimsScreen: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [hospitalName, setHospitalName] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);

  const {
    data: claimsData,
    isLoading: claimsLoading,
    refetch: refetchClaims,
    isRefetching,
  } = useQuery<PaginatedResponse<Claim>>({
    queryKey: ['claims'],
    queryFn: getClaims,
  });

  const { data: policiesData, isLoading: policiesLoading } = useQuery<
    ApiResponse<Policy[]>
  >({
    queryKey: ['policies'],
    queryFn: getPolicies,
  });

  const submitMutation = useMutation({
    mutationFn: (data: {
      policyId: string;
      amount: number;
      description: string;
      hospitalName: string;
    }) =>
      submitClaim({
        policyId: data.policyId,
        amount: data.amount,
        description: data.description,
        hospitalName: data.hospitalName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      Alert.alert(t('claims.success'));
      resetForm();
    },
    onError: () => {
      Alert.alert(t('common.error'), t('claims.failed'));
    },
  });

  const claims = claimsData?.data ?? [];
  const policies = policiesData?.data ?? [];
  const activePolicies = policies.filter((p) => p.status === 'active');

  const resetForm = () => {
    setShowForm(false);
    setHospitalName('');
    setDiagnosis('');
    setAmount('');
    setSelectedPolicyId(null);
  };

  const handleSubmit = () => {
    if (!selectedPolicyId) {
      Alert.alert(t('common.error'), t('claims.select_policy'));
      return;
    }
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) {
      Alert.alert(t('common.error'), t('claims.amount'));
      return;
    }
    if (!hospitalName.trim()) {
      Alert.alert(t('common.error'), t('claims.hospital_name'));
      return;
    }

    submitMutation.mutate({
      policyId: selectedPolicyId,
      amount: amountNum * 100, // Convert to paise
      description: diagnosis,
      hospitalName: hospitalName,
    });
  };

  const getStatusLabel = (status: ClaimStatus): string => {
    const key = `claims.status_${status}` as const;
    return t(key);
  };

  if (claimsLoading || policiesLoading) {
    return <LoadingSpinner />;
  }

  const renderClaimItem = ({ item }: { item: Claim }) => {
    const statusStyle = statusColors[item.status];
    return (
      <Card style={styles.claimCard}>
        <View style={styles.claimHeader}>
          <Text style={styles.claimHospital}>
            {item.hospitalName || item.description}
          </Text>
          <View
            style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}
          >
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>
        {item.diagnosisCode && (
          <Text style={styles.claimDiagnosis}>{item.diagnosisCode}</Text>
        )}
        <View style={styles.claimFooter}>
          <Text style={styles.claimAmount}>
            {'\u20B9'}{formatCurrency(item.amount)}
          </Text>
          <Text style={styles.claimDate}>
            {new Date(item.submittedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
      </Card>
    );
  };

  const renderForm = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.formTitle}>{t('claims.submit_claim')}</Text>

        {/* Policy Selector */}
        <Text style={styles.fieldLabel}>{t('claims.select_policy')}</Text>
        {activePolicies.length === 0 ? (
          <Card style={styles.noPoliciesCard}>
            <Text style={styles.noPoliciesText}>
              {t('claims.no_active_policies')}
            </Text>
          </Card>
        ) : (
          <View style={styles.policyList}>
            {activePolicies.map((policy) => (
              <TouchableOpacity
                key={policy.id}
                style={[
                  styles.policyOption,
                  selectedPolicyId === policy.id &&
                    styles.policyOptionActive,
                ]}
                onPress={() => setSelectedPolicyId(policy.id)}
              >
                <Text
                  style={[
                    styles.policyOptionText,
                    selectedPolicyId === policy.id &&
                      styles.policyOptionTextActive,
                  ]}
                >
                  {policy.plan.name} - #{policy.policyNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Input
          label={t('claims.hospital_name')}
          placeholder="Enter hospital name"
          value={hospitalName}
          onChangeText={setHospitalName}
        />

        <Input
          label={t('claims.diagnosis')}
          placeholder="Enter diagnosis details"
          value={diagnosis}
          onChangeText={setDiagnosis}
          multiline
        />

        <Input
          label={t('claims.amount')}
          placeholder="Enter amount"
          value={amount}
          onChangeText={(text) =>
            setAmount(text.replace(/[^0-9]/g, ''))
          }
          keyboardType="number-pad"
          leftIcon={<Text style={styles.rupeeSymbol}>{'\u20B9'}</Text>}
        />

        {/* Document Upload Placeholder */}
        <Text style={styles.fieldLabel}>{t('claims.documents')}</Text>
        <TouchableOpacity style={styles.uploadPlaceholder}>
          <Text style={styles.uploadIcon}>+</Text>
          <Text style={styles.uploadText}>{t('claims.upload_documents')}</Text>
          <Text style={styles.uploadHint}>{t('claims.document_placeholder')}</Text>
        </TouchableOpacity>

        <Button
          title={t('claims.submit')}
          onPress={handleSubmit}
          loading={submitMutation.isPending}
          disabled={
            !selectedPolicyId ||
            !hospitalName.trim() ||
            !amount ||
            activePolicies.length === 0
          }
          style={styles.submitButton}
        />

        <Button
          title={t('common.cancel')}
          onPress={resetForm}
          variant="outline"
          style={styles.cancelButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (showForm) {
    return (
      <SafeAreaView style={styles.container}>{renderForm()}</SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('claims.title')}</Text>
        <Button
          title={t('claims.submit_claim')}
          onPress={() => setShowForm(true)}
          variant="primary"
          style={styles.newClaimButton}
          textStyle={styles.newClaimButtonText}
        />
      </View>

      <FlatList
        data={claims}
        keyExtractor={(item) => item.id}
        renderItem={renderClaimItem}
        ListEmptyComponent={
          <EmptyState
            title={t('claims.no_claims')}
            subtitle={t('claims.no_claims_subtitle')}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetchClaims}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
  },
  newClaimButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  newClaimButtonText: {
    fontSize: 12,
  },
  listContent: {
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  claimCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  claimHospital: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
  },
  claimDiagnosis: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  claimFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  claimAmount: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  claimDate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  // Form styles
  formContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  formTitle: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  policyList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  policyOption: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  policyOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  policyOptionText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  policyOptionTextActive: {
    color: colors.primary,
  },
  noPoliciesCard: {
    marginBottom: spacing.md,
  },
  noPoliciesText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  rupeeSymbol: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  uploadPlaceholder: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  uploadIcon: {
    fontSize: 28,
    color: colors.textTertiary,
    fontWeight: '300',
  },
  uploadText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  uploadHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  cancelButton: {
    marginTop: spacing.sm,
  },
});

export default ClaimsScreen;
