import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import ProgressBar from '../components/common/ProgressBar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { getPlans, getPolicies, subscribe } from '../api/insurance';
import { getHsa } from '../api/hsa';
import { formatCurrency } from '../components/home/BalanceCard';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { InsurancePlan, Policy, HSA, ApiResponse } from '../types';

const InsuranceScreen: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: hsaData, isLoading: hsaLoading } = useQuery<ApiResponse<HSA>>({
    queryKey: ['hsa'],
    queryFn: getHsa,
  });

  const { data: plansData, isLoading: plansLoading } = useQuery<
    ApiResponse<InsurancePlan[]>
  >({
    queryKey: ['insurance-plans'],
    queryFn: getPlans,
  });

  const { data: policiesData, isLoading: policiesLoading } = useQuery<
    ApiResponse<Policy[]>
  >({
    queryKey: ['policies'],
    queryFn: getPolicies,
  });

  const subscribeMutation = useMutation({
    mutationFn: subscribe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['hsa'] });
    },
    onError: () => {
      Alert.alert(t('common.error'), t('common.error'));
    },
  });

  const hsa = hsaData?.data;
  const plans = plansData?.data ?? [];
  const policies = policiesData?.data ?? [];
  const isLoading = hsaLoading || plansLoading || policiesLoading;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const progress =
    hsa && hsa.insuranceThreshold > 0
      ? hsa.totalContributed / hsa.insuranceThreshold
      : 0;

  const handleSubscribe = (plan: InsurancePlan) => {
    if (!hsa?.insuranceEligible) {
      Alert.alert(t('insurance.title'), t('insurance.not_eligible'));
      return;
    }
    Alert.alert(
      t('insurance.subscribe'),
      `${plan.name} - ₹${formatCurrency(plan.premium)}${t('common.per_month')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('insurance.subscribe'),
          onPress: () => subscribeMutation.mutate(plan.id),
        },
      ],
    );
  };

  const renderPlan = ({ item: plan }: { item: InsurancePlan }) => (
    <Card style={styles.planCard}>
      <View style={styles.planHeader}>
        <Text style={styles.planName}>{plan.name}</Text>
        <View
          style={[
            styles.planBadge,
            {
              backgroundColor:
                plan.type === 'premium'
                  ? colors.accentLight
                  : plan.type === 'standard'
                  ? colors.primaryLight
                  : colors.divider,
            },
          ]}
        >
          <Text style={styles.planBadgeText}>
            {t(`insurance.plan_${plan.type}`)}
          </Text>
        </View>
      </View>

      <Text style={styles.planDescription}>{plan.description}</Text>

      <View style={styles.planDetails}>
        <View style={styles.planDetailRow}>
          <Text style={styles.planDetailLabel}>{t('insurance.coverage')}</Text>
          <Text style={styles.planDetailValue}>
            ₹{formatCurrency(plan.coverageAmount)}
          </Text>
        </View>
        <View style={styles.planDetailRow}>
          <Text style={styles.planDetailLabel}>{t('insurance.premium')}</Text>
          <Text style={styles.planDetailValue}>
            ₹{formatCurrency(plan.premium)}{t('common.per_month')}
          </Text>
        </View>
      </View>

      {plan.features.length > 0 && (
        <View style={styles.features}>
          <Text style={styles.featuresLabel}>{t('insurance.features')}</Text>
          {plan.features.map((feature, index) => (
            <Text key={index} style={styles.featureItem}>
              {'\u2022'} {feature}
            </Text>
          ))}
        </View>
      )}

      <Button
        title={t('insurance.subscribe')}
        onPress={() => handleSubscribe(plan)}
        variant={hsa?.insuranceEligible ? 'primary' : 'outline'}
        disabled={!hsa?.insuranceEligible || subscribeMutation.isPending}
        loading={subscribeMutation.isPending}
        style={styles.subscribeButton}
      />
    </Card>
  );

  const renderPolicy = ({ item: policy }: { item: Policy }) => (
    <Card style={styles.policyCard}>
      <View style={styles.policyHeader}>
        <Text style={styles.policyName}>{policy.plan.name}</Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                policy.status === 'active'
                  ? colors.secondaryLight
                  : colors.errorLight,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color:
                  policy.status === 'active'
                    ? colors.secondary
                    : colors.error,
              },
            ]}
          >
            {policy.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.policyNumber}>#{policy.policyNumber}</Text>
      <Text style={styles.policyDates}>
        {new Date(policy.startDate).toLocaleDateString('en-IN')} -{' '}
        {new Date(policy.endDate).toLocaleDateString('en-IN')}
      </Text>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        renderItem={renderPlan}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <Text style={styles.screenTitle}>{t('insurance.title')}</Text>

            {/* Eligibility Meter */}
            <Card style={styles.meterCard}>
              <Text style={styles.sectionTitle}>
                {t('insurance.eligibility_meter')}
              </Text>
              <ProgressBar
                progress={Math.min(progress, 1)}
                color={
                  hsa?.insuranceEligible ? colors.secondary : colors.primary
                }
                height={12}
                style={styles.meterBar}
              />
              <Text style={styles.meterText}>
                {hsa?.insuranceEligible
                  ? t('home.eligible')
                  : `₹${formatCurrency(hsa?.totalContributed ?? 0)} / ₹${formatCurrency(hsa?.insuranceThreshold ?? 0)}`}
              </Text>
            </Card>

            {/* Active Policies */}
            {policies.length > 0 && (
              <View>
                <Text style={styles.sectionHeader}>
                  {t('insurance.active_policies')}
                </Text>
                {policies.map((policy) => (
                  <View key={policy.id}>{renderPolicy({ item: policy })}</View>
                ))}
              </View>
            )}

            <Text style={styles.sectionHeader}>
              {t('insurance.available_plans')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title={t('insurance.no_plans')} />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  screenTitle: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  meterCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  meterBar: {
    marginTop: spacing.sm,
  },
  meterText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  sectionHeader: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  planCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  planBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  planBadgeText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  planDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  planDetails: {
    marginTop: spacing.md,
  },
  planDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  planDetailLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  planDetailValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  features: {
    marginTop: spacing.md,
  },
  featuresLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  featureItem: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    marginBottom: 2,
  },
  subscribeButton: {
    marginTop: spacing.md,
  },
  policyCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  policyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  policyName: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
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
  policyNumber: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  policyDates: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default InsuranceScreen;
