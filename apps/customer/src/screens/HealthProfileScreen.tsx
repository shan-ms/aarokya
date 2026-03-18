import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Gender, BloodGroup } from '../types';

const BLOOD_GROUPS: BloodGroup[] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
];

const HealthProfileScreen: React.FC = () => {
  const { t } = useTranslation();

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

  const handleSave = async () => {
    setSaving(true);
    try {
      // API call would go here
      Alert.alert(t('health.saved'));
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const renderGenderSelector = () => {
    const genders: { key: Gender; label: string }[] = [
      { key: 'male', label: t('health.male') },
      { key: 'female', label: t('health.female') },
      { key: 'other', label: t('health.other') },
    ];

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

  const renderBloodGroupSelector = () => (
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('health.title')}</Text>

        <Card style={styles.section}>
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
        </Card>

        <Card style={styles.section}>
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
        </Card>

        <Card style={styles.section}>
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
        </Card>

        <Button
          title={t('health.save')}
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
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
  title: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
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
});

export default HealthProfileScreen;
