import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Gender, BloodGroup } from '../types';

const BLOOD_GROUPS: BloodGroup[] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
];

interface MedicationReminder {
  id: string;
  name: string;
  time: string;
  enabled: boolean;
}

const HealthProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);

  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const [reminders, setReminders] = useState<MedicationReminder[]>([]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // API call would go here
      Alert.alert(t('health.saved'));
      setIsEditing(false);
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const toggleReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  };

  const addReminder = () => {
    const newReminder: MedicationReminder = {
      id: Date.now().toString(),
      name: medications.split(',')[0]?.trim() || 'Medication',
      time: '08:00 AM',
      enabled: true,
    };
    setReminders((prev) => [...prev, newReminder]);
  };

  const renderGenderSelector = () => {
    const genders: { key: Gender; label: string }[] = [
      { key: 'male', label: t('health.male') },
      { key: 'female', label: t('health.female') },
      { key: 'other', label: t('health.other') },
    ];

    if (!isEditing) {
      const selected = genders.find((g) => g.key === gender);
      return (
        <Text style={styles.viewValue}>{selected?.label || '-'}</Text>
      );
    }

    return (
      <View style={styles.selectorRow}>
        {genders.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[
              styles.selectorButton,
              gender === g.key && styles.selectorButtonActive,
            ]}
            onPress={() => setGender(g.key)}
          >
            <Text
              style={[
                styles.selectorText,
                gender === g.key && styles.selectorTextActive,
              ]}
            >
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderBloodGroupSelector = () => {
    if (!isEditing) {
      return (
        <Text style={styles.viewValue}>{bloodGroup || '-'}</Text>
      );
    }

    return (
      <View style={styles.bloodGroupGrid}>
        {BLOOD_GROUPS.map((bg) => (
          <TouchableOpacity
            key={bg}
            style={[
              styles.bloodGroupButton,
              bloodGroup === bg && styles.bloodGroupButtonActive,
            ]}
            onPress={() => setBloodGroup(bg)}
          >
            <Text
              style={[
                styles.bloodGroupText,
                bloodGroup === bg && styles.bloodGroupTextActive,
              ]}
            >
              {bg}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderViewField = (label: string, value: string) => (
    <View style={styles.viewField}>
      <Text style={styles.viewLabel}>{label}</Text>
      <Text style={styles.viewValue}>{value || '-'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('health.title')}</Text>
          <TouchableOpacity
            onPress={() => setIsEditing(!isEditing)}
            style={styles.editToggle}
          >
            <Text style={styles.editToggleText}>
              {isEditing ? t('health.view_mode') : t('health.edit')}
            </Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.section}>
          {isEditing ? (
            <>
              <Input
                label={t('health.dob')}
                placeholder="DD/MM/YYYY"
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                keyboardType="number-pad"
              />

              <Text style={styles.fieldLabel}>{t('health.gender')}</Text>
              {renderGenderSelector()}

              <Text style={styles.fieldLabel}>{t('health.blood_group')}</Text>
              {renderBloodGroupSelector()}

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Input
                    label={t('health.height')}
                    placeholder="170"
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Input
                    label={t('health.weight')}
                    placeholder="65"
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              {renderViewField(t('health.dob'), dateOfBirth)}
              <View style={styles.divider} />
              <Text style={styles.fieldLabel}>{t('health.gender')}</Text>
              {renderGenderSelector()}
              <View style={styles.divider} />
              <Text style={styles.fieldLabel}>{t('health.blood_group')}</Text>
              {renderBloodGroupSelector()}
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  {renderViewField(t('health.height'), height ? `${height} cm` : '-')}
                </View>
                <View style={styles.halfInput}>
                  {renderViewField(t('health.weight'), weight ? `${weight} kg` : '-')}
                </View>
              </View>
            </>
          )}
        </Card>

        <Card style={styles.section}>
          {isEditing ? (
            <>
              <Input
                label={t('health.conditions')}
                placeholder="e.g., Diabetes, Hypertension"
                value={conditions}
                onChangeText={setConditions}
                multiline
              />
              <Input
                label={t('health.medications')}
                placeholder="e.g., Metformin 500mg"
                value={medications}
                onChangeText={setMedications}
                multiline
              />
              <Input
                label={t('health.allergies')}
                placeholder="e.g., Penicillin, Peanuts"
                value={allergies}
                onChangeText={setAllergies}
                multiline
              />
            </>
          ) : (
            <>
              {renderViewField(t('health.conditions'), conditions)}
              <View style={styles.divider} />
              {renderViewField(t('health.medications'), medications)}
              <View style={styles.divider} />
              {renderViewField(t('health.allergies'), allergies)}
            </>
          )}
        </Card>

        <Card style={styles.section}>
          {isEditing ? (
            <>
              <Text style={styles.sectionTitle}>
                {t('health.emergency_contact')}
              </Text>
              <Input
                label={t('health.emergency_name')}
                placeholder="Full Name"
                value={emergencyName}
                onChangeText={setEmergencyName}
              />
              <Input
                label={t('health.emergency_phone')}
                placeholder="10-digit mobile number"
                value={emergencyPhone}
                onChangeText={(text) =>
                  setEmergencyPhone(text.replace(/[^0-9]/g, '').slice(0, 10))
                }
                keyboardType="phone-pad"
                maxLength={10}
              />
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                {t('health.emergency_contact')}
              </Text>
              {renderViewField(t('health.emergency_name'), emergencyName)}
              <View style={styles.divider} />
              {renderViewField(t('health.emergency_phone'), emergencyPhone)}
            </>
          )}
        </Card>

        {/* Medication Reminders Section */}
        <Card style={styles.section}>
          <View style={styles.reminderHeader}>
            <Text style={styles.sectionTitle}>
              {t('health.medication_reminders')}
            </Text>
            <TouchableOpacity onPress={addReminder}>
              <Text style={styles.addReminderText}>
                + {t('health.add_reminder')}
              </Text>
            </TouchableOpacity>
          </View>

          {reminders.length === 0 ? (
            <Text style={styles.noRemindersText}>
              {t('health.no_reminders')}
            </Text>
          ) : (
            reminders.map((reminder) => (
              <View key={reminder.id} style={styles.reminderItem}>
                <View style={styles.reminderInfo}>
                  <Text style={styles.reminderName}>{reminder.name}</Text>
                  <Text style={styles.reminderTime}>{reminder.time}</Text>
                </View>
                <Switch
                  value={reminder.enabled}
                  onValueChange={() => toggleReminder(reminder.id)}
                  trackColor={{
                    false: colors.border,
                    true: colors.primaryLight,
                  }}
                  thumbColor={
                    reminder.enabled ? colors.primary : colors.textTertiary
                  }
                />
              </View>
            ))
          )}
        </Card>

        {isEditing && (
          <Button
            title={t('health.save')}
            onPress={handleSave}
            loading={saving}
            style={styles.saveButton}
          />
        )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
  },
  editToggle: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
  },
  editToggleText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  viewField: {
    paddingVertical: spacing.sm,
  },
  viewLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  viewValue: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  selectorButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  selectorButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  selectorText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  selectorTextActive: {
    color: colors.primary,
  },
  bloodGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bloodGroupButton: {
    width: 60,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  bloodGroupButtonActive: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  bloodGroupText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  bloodGroupTextActive: {
    color: colors.error,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  // Medication Reminders
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addReminderText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  noRemindersText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  reminderTime: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default HealthProfileScreen;
