import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import { createCheckin } from '../api/checkin';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Symptom, UrgencyLevel, TriageResult } from '../types';

const SEVERITIES: Array<{ key: Symptom['severity']; labelKey: string }> = [
  { key: 'mild', labelKey: 'checkin.severity_mild' },
  { key: 'moderate', labelKey: 'checkin.severity_moderate' },
  { key: 'severe', labelKey: 'checkin.severity_severe' },
];

const getUrgencyColor = (level: UrgencyLevel): string => {
  switch (level) {
    case 'emergency':
      return colors.error;
    case 'urgent':
      return colors.accent;
    case 'schedule_visit':
      return colors.primary;
    case 'self_care':
      return colors.secondary;
    default:
      return colors.textSecondary;
  }
};

const getUrgencyLabelKey = (level: UrgencyLevel): string => {
  switch (level) {
    case 'emergency':
      return 'checkin.urgency_emergency';
    case 'urgent':
      return 'checkin.urgency_urgent';
    case 'schedule_visit':
      return 'checkin.urgency_schedule';
    case 'self_care':
      return 'checkin.urgency_self_care';
    default:
      return '';
  }
};

const CheckInScreen: React.FC = () => {
  const { t } = useTranslation();

  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [symptomName, setSymptomName] = useState('');
  const [severity, setSeverity] = useState<Symptom['severity']>('mild');
  const [duration, setDuration] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [result, setResult] = useState<TriageResult | null>(null);

  const checkinMutation = useMutation({
    mutationFn: () => createCheckin(symptoms, undefined, additionalNotes || undefined),
    onSuccess: (response) => {
      const data = response.data as TriageResult;
      setResult(data);
    },
    onError: () => {
      Alert.alert(t('common.error'), t('checkin.submit_error'));
    },
  });

  const handleCall112 = useCallback(() => {
    Linking.openURL('tel:112');
  }, []);

  const handleAddSymptom = useCallback(() => {
    const trimmed = symptomName.trim();
    if (!trimmed) {
      return;
    }
    const newSymptom: Symptom = {
      name: trimmed,
      severity,
      duration: duration.trim() || undefined,
    };
    setSymptoms((prev) => [...prev, newSymptom]);
    setSymptomName('');
    setDuration('');
    setSeverity('mild');
  }, [symptomName, severity, duration]);

  const handleRemoveSymptom = useCallback((index: number) => {
    setSymptoms((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(() => {
    if (symptoms.length === 0) {
      Alert.alert(t('checkin.no_symptoms_title'), t('checkin.no_symptoms_message'));
      return;
    }
    checkinMutation.mutate();
  }, [symptoms, checkinMutation, t]);

  const handleReset = useCallback(() => {
    setSymptoms([]);
    setSymptomName('');
    setSeverity('mild');
    setDuration('');
    setAdditionalNotes('');
    setResult(null);
  }, []);

  if (result) {
    const isEmergency = result.emergency;
    const urgencyColor = getUrgencyColor(result.urgencyLevel);

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {isEmergency && (
            <View style={styles.emergencyResultBanner}>
              <Text style={styles.emergencyResultTitle}>{t('checkin.emergency_title')}</Text>
              <Text style={styles.emergencyResultText}>{t('checkin.emergency_call_now')}</Text>
              <Button
                title={t('checkin.call_112')}
                onPress={handleCall112}
                variant="primary"
                style={styles.emergencyCallButton}
              />
            </View>
          )}

          <Card style={styles.resultCard}>
            <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor }]}>
              <Text style={styles.urgencyBadgeText}>
                {t(getUrgencyLabelKey(result.urgencyLevel))}
              </Text>
            </View>

            <Text style={styles.resultRecommendation}>{result.recommendation}</Text>

            {result.suggestedActions.length > 0 && (
              <View style={styles.actionsSection}>
                <Text style={styles.actionsSectionTitle}>
                  {t('checkin.suggested_actions')}
                </Text>
                {result.suggestedActions.map((action, index) => (
                  <View key={index} style={styles.actionRow}>
                    <View style={styles.actionBullet} />
                    <Text style={styles.actionText}>{action}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Button
            title={t('checkin.start_over')}
            onPress={handleReset}
            variant="outline"
            style={styles.resetButton}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.emergencyBanner}
          onPress={handleCall112}
          activeOpacity={0.8}
        >
          <Text style={styles.emergencyBannerText}>
            {t('checkin.emergency_banner')}
          </Text>
          <View style={styles.emergencyCallBadge}>
            <Text style={styles.emergencyCallBadgeText}>{t('checkin.call_112')}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <Text style={styles.title}>{t('checkin.title')}</Text>
          <Text style={styles.subtitle}>{t('checkin.subtitle')}</Text>
        </View>

        <Card style={styles.addSymptomCard}>
          <Text style={styles.sectionTitle}>{t('checkin.add_symptoms')}</Text>

          <Input
            label={t('checkin.symptom_name')}
            placeholder={t('checkin.symptom_placeholder')}
            value={symptomName}
            onChangeText={setSymptomName}
          />

          <Text style={styles.fieldLabel}>{t('checkin.severity')}</Text>
          <View style={styles.severityRow}>
            {SEVERITIES.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.severityOption,
                  severity === s.key && styles.severityOptionSelected,
                ]}
                onPress={() => setSeverity(s.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.severityOptionText,
                    severity === s.key && styles.severityOptionTextSelected,
                  ]}
                >
                  {t(s.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label={t('checkin.duration')}
            placeholder={t('checkin.duration_placeholder')}
            value={duration}
            onChangeText={setDuration}
          />

          <Button
            title={t('checkin.add_symptom')}
            onPress={handleAddSymptom}
            variant="outline"
            disabled={!symptomName.trim()}
          />
        </Card>

        {symptoms.length > 0 && (
          <Card style={styles.symptomListCard}>
            <Text style={styles.sectionTitle}>
              {t('checkin.your_symptoms', { count: symptoms.length })}
            </Text>
            {symptoms.map((symptom, index) => (
              <View key={index} style={styles.symptomItem}>
                <View style={styles.symptomInfo}>
                  <Text style={styles.symptomName}>{symptom.name}</Text>
                  <Text style={styles.symptomMeta}>
                    {t(`checkin.severity_${symptom.severity}`)}
                    {symptom.duration ? ` - ${symptom.duration}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveSymptom(index)}
                  style={styles.removeButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.removeButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        <Card style={styles.notesCard}>
          <Input
            label={t('checkin.additional_notes')}
            placeholder={t('checkin.notes_placeholder')}
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
            multiline
            numberOfLines={3}
          />
        </Card>

        <Button
          title={t('checkin.get_guidance')}
          onPress={handleSubmit}
          variant="primary"
          loading={checkinMutation.isPending}
          disabled={symptoms.length === 0}
          style={styles.submitButton}
        />
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
  emergencyBanner: {
    backgroundColor: colors.error,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emergencyBannerText: {
    ...typography.bodyMedium,
    color: colors.surface,
    fontWeight: '600',
    flex: 1,
  },
  emergencyCallBadge: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
  },
  emergencyCallBadgeText: {
    ...typography.label,
    color: colors.error,
    fontWeight: '700',
  },
  headerSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  addSymptomCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  severityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  severityOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  severityOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  severityOptionText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  severityOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  symptomListCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  symptomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  symptomInfo: {
    flex: 1,
  },
  symptomName: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  symptomMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  removeButtonText: {
    ...typography.label,
    color: colors.error,
    fontWeight: '700',
  },
  notesCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  submitButton: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  // Result styles
  emergencyResultBanner: {
    backgroundColor: colors.error,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emergencyResultTitle: {
    ...typography.headlineLarge,
    color: colors.surface,
    fontWeight: '700',
  },
  emergencyResultText: {
    ...typography.bodyLarge,
    color: colors.surface,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  emergencyCallButton: {
    backgroundColor: colors.surface,
    marginTop: spacing.md,
    minWidth: 200,
  },
  resultCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  urgencyBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  urgencyBadgeText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '700',
  },
  resultRecommendation: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  actionsSection: {
    marginTop: spacing.md,
  },
  actionsSectionTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  actionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 7,
    marginRight: spacing.sm,
  },
  actionText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    flex: 1,
  },
  resetButton: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
});

export default CheckInScreen;
