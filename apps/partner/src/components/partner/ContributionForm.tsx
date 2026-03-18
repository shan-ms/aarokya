import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { WorkerWithHsa, ContributionSourceType } from '../../types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import Input from '../common/Input';
import Button from '../common/Button';

interface ContributionFormProps {
  workers: WorkerWithHsa[];
  selectedWorkerIds: string[];
  onWorkerToggle: (workerId: string) => void;
  onSubmit: (amountPaise: number, sourceType: ContributionSourceType) => void;
  loading?: boolean;
  mode: 'individual' | 'bulk';
}

const SOURCE_TYPES: { key: ContributionSourceType; label: string }[] = [
  { key: 'employer', label: 'Employer' },
  { key: 'platform_fee', label: 'Platform Fee' },
  { key: 'csr', label: 'CSR' },
  { key: 'grant', label: 'Grant' },
];

const ContributionForm: React.FC<ContributionFormProps> = ({
  workers,
  selectedWorkerIds,
  onWorkerToggle,
  onSubmit,
  loading = false,
  mode,
}) => {
  const [amountText, setAmountText] = useState('');
  const [sourceType, setSourceType] = useState<ContributionSourceType>('employer');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const amount = parseFloat(amountText);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (selectedWorkerIds.length === 0) {
      setError('Please select at least one worker');
      return;
    }
    setError(null);
    const amountPaise = Math.round(amount * 100);
    onSubmit(amountPaise, sourceType);
  };

  const totalAmountPaise = selectedWorkerIds.length * Math.round((parseFloat(amountText) || 0) * 100);
  const formattedTotal = `\u20b9${(totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        {mode === 'individual' ? 'Select Worker' : 'Select Workers'}
      </Text>
      <ScrollView
        horizontal={mode === 'individual'}
        style={mode === 'bulk' ? styles.workerList : undefined}
        showsHorizontalScrollIndicator={false}
      >
        {workers.map((worker) => {
          const isSelected = selectedWorkerIds.includes(worker.id);
          return (
            <TouchableOpacity
              key={worker.id}
              style={[styles.workerChip, isSelected && styles.workerChipSelected]}
              onPress={() => onWorkerToggle(worker.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.chipAvatar, isSelected && styles.chipAvatarSelected]}>
                <Text
                  style={[
                    styles.chipAvatarText,
                    isSelected && styles.chipAvatarTextSelected,
                  ]}
                >
                  {worker.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text
                style={[styles.chipName, isSelected && styles.chipNameSelected]}
                numberOfLines={1}
              >
                {worker.name}
              </Text>
              {isSelected && <Text style={styles.checkmark}>{'  \u2713'}</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedWorkerIds.length > 0 && (
        <Text style={styles.selectedCount}>
          {selectedWorkerIds.length} worker{selectedWorkerIds.length > 1 ? 's' : ''} selected
        </Text>
      )}

      <Input
        label={mode === 'bulk' ? 'Amount Per Worker (\u20b9)' : 'Amount (\u20b9)'}
        placeholder="Enter amount"
        keyboardType="numeric"
        value={amountText}
        onChangeText={(text) => {
          setAmountText(text.replace(/[^0-9.]/g, ''));
          setError(null);
        }}
      />

      <Text style={styles.sectionTitle}>Source Type</Text>
      <View style={styles.sourceTypeRow}>
        {SOURCE_TYPES.map((st) => (
          <TouchableOpacity
            key={st.key}
            style={[
              styles.sourceTypeChip,
              sourceType === st.key && styles.sourceTypeChipActive,
            ]}
            onPress={() => setSourceType(st.key)}
          >
            <Text
              style={[
                styles.sourceTypeText,
                sourceType === st.key && styles.sourceTypeTextActive,
              ]}
            >
              {st.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {selectedWorkerIds.length > 0 && amountText && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formattedTotal}</Text>
        </View>
      )}

      <Button
        title="Proceed to Payment"
        onPress={handleSubmit}
        loading={loading}
        disabled={selectedWorkerIds.length === 0 || !amountText}
        size="lg"
        style={styles.submitButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  workerList: {
    maxHeight: 200,
  },
  workerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  workerChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  chipAvatarSelected: {
    backgroundColor: colors.primary,
  },
  chipAvatarText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipAvatarTextSelected: {
    color: colors.surface,
  },
  chipName: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textPrimary,
    maxWidth: 120,
  },
  chipNameSelected: {
    color: colors.primary,
  },
  checkmark: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  selectedCount: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sourceTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sourceTypeChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sourceTypeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sourceTypeText: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sourceTypeTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginBottom: spacing.md,
  },
  totalLabel: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  totalValue: {
    ...typography.headlineLarge,
    color: colors.primary,
  },
  submitButton: {
    marginTop: spacing.md,
  },
});

export default ContributionForm;
