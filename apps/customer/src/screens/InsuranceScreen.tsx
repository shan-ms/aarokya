import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { getPlans, getPolicies, subscribe } from '../api/insurance';
import { getHsa } from '../api/hsa';
import { formatCurrency } from '../components/home/BalanceCard';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { InsurancePlan, Policy, HSA, ApiResponse } from '../types';

const CIRCLE_SIZE = 140;
const STROKE_WIDTH = 12;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const InsuranceScreen: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  const {
    data: hsaData,
    isLoading: hsaLoading,
    refetch: refetchHsa,
  } = useQuery<ApiResponse<HSA>>({
    queryKey: ['hsa'],
    queryFn: getHsa,
  });

  const {
    data: plansData,
    isLoading: plansLoading,
    refetch: refetchPlans,
  } = useQuery<ApiResponse<InsurancePlan[]>>({
    queryKey: ['insurance-plans'],
    queryFn: getPlans,
  });

  const {
    data: policiesData,
    isLoading: policiesLoading,
    refetch: refetchPolicies,
    isRefetching,
  } = useQuery<ApiResponse<Policy[]>>({
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

  const handleRefresh = () => {
    refetchHsa();
    refetchPlans();
    refetchPolicies();
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const progress =
    hsa && hsa.insuranceThreshold > 0
      ? Math.min(hsa.totalContributed / hsa.insuranceThreshold, 1)
      : 0;

  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const progressPercent = Math.round(progress * 100);

  const handleSubscribe = (plan: InsurancePlan) => {
    if (!hsa?.insuranceEligible) {
      Alert.alert(t('insurance.title'), t('insurance.not_eligible'));
      return;
    }
    Alert.alert(
      t('insurance.subscribe'),
      `${plan.name} - \u20B9${formatCurrency(plan.premium)}${t('common.per_month')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('insurance.subscribe'),
          onPress: () => subscribeMutation.mutate(plan.id),
        },
      ],
    );
  };

  const renderCircularProgress = () => (
    <Card style={styles.meterCard}>
      <Text style={styles.sectionTitle}>
        {t('insurance.eligibility_meter')}
      </Text>
      <View style={styles.circularContainer}>
        <View style={styles.circularMeter}>
          {/* Background Circle */}
          <View
            style={[
              styles.circleTrack,
              {
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
                borderRadius: CIRCLE_SIZE / 2,
                borderWidth: STROKE_WIDTH,
                borderColor: colors.primaryLight,
              },
            ]}
          />
          {/* Progress overlay using a bordered view with clip */}
          <View
            style={[
              styles.circleProgress,
              {
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
                borderRadius: CIRCLE_SIZE / 2,
                borderWidth: STROKE_WIDTH,
                borderColor: hsa?.insuranceEligible
                  ? colors.secondary
                  : colors.primary,
                // Simulate progress with opacity-based segments
                opacity: progress > 0 ? 1 : 0,
              },
            ]}
          />
          {/* Center text */}
          <View style={styles.circleCenter}>
            <Text
              style={[
                styles.percentText,
                {
                  color: hsa?.insuranceEligible
                    ? colors.secondary
                    : colors.primary,
                },
              ]}
            >
              {progressPercent}%
            </Text>
            <Text style={styles.percentLabel}>
              {hsa?.insuranceEligible
                ? t('home.eligible')
                : t('insurance.not_eligible')}
            </Text>
          </View>
        </View>
        <Text style={styles.meterText}>
          {'\u20B9'}{formatCurrency(hsa?.totalContributed ?? 0)} / {'\u20B9'}
          {formatCurrency(hsa?.insuranceThreshold ?? 0)}
        </Text>
      </View>
    </Card>
  );

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
            {'\u20B9'}{formatCurrency(plan.coverageAmount)}
          </Text>
        </View>
        <View style={styles.planDetailRow}>
          <Text style={styles.planDetailLabel}>{t('insurance.premium')}</Text>
          <Text style={styles.planDetailValue}>
            {'\u20B9'}{formatCurrency(plan.premium)}{t('common.per_month')}
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

  const renderPolicy = (policy: Policy) => {
    const statusColorMap: Record<string, { bg: string; text: string }> = {
      active: { bg: colors.secondaryLight, text: colors.secondary },
      expired: { bg: colors.divider, text: colors.textTertiary },
      cancelled: { bg: colors.errorLight, text: colors.error },
      pending: { bg: colors.accentLight, text: colors.accent },
    };
    const sc = statusColorMap[policy.status] || statusColorMap.pending;

    return (
      <Card key={policy.id} style={styles.policyCard}>
        <View style={styles.policyHeader}>
          <Text style={styles.policyName}>{policy.plan.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        renderItem={renderPlan}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.screenTitle}>{t('insurance.title')}</Text>

            {renderCircularProgress()}

            {/* Active Policies */}
            {policies.length > 0 && (
              <View>
                <Text style={styles.sectionHeader}>
                  {t('insurance.active_policies')}
                </Text>
                {policies.map(renderPolicy)}
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
  sectionTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  circularContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  circularMeter: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleTrack: {
    position: 'absolute',
  },
  circleProgress: {
    position: 'absolute',
  },
  circleCenter: {
    alignItems: 'center',
  },
  percentText: {
    ...typography.displaySmall,
    fontWeight: '700',
  },
  percentLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 100,
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
