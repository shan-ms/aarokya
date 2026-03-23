import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { StackNavigationProp } from '@react-navigation/stack';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Gender, BloodGroup } from '../../types';

type AuthStackParamList = {
  Welcome: undefined;
  PhoneInput: undefined;
  OTP: { phone: string };
  ABHALink: undefined;
  HealthProfileSetup: undefined;
};

type HealthProfileSetupNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'HealthProfileSetup'
>;

interface HealthProfileSetupScreenProps {
  navigation: HealthProfileSetupNavigationProp;
}

const BLOOD_GROUPS: BloodGroup[] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
];

const HealthProfileSetupScreen: React.FC<HealthProfileSetupScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Mark onboarding complete by updating user (the auth state change
      // will transition from AuthNavigator to MainNavigator)
      if (user) {
        setUser({ ...user, updatedAt: new Date().toISOString() });
      }
      // Navigation happens automatically via AppNavigator auth state
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    // Mark onboarding complete
    if (user) {
      setUser({ ...user, updatedAt: new Date().toISOString() });
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
        <View style={styles.header}>
          <Text style={styles.title}>{t('health_setup.title')}</Text>
          <Text style={styles.subtitle}>{t('health_setup.subtitle')}</Text>
        </View>

        <Card style={styles.section}>
          <Input
            label={t('health_setup.age')}
            placeholder="25"
            value={age}
            onChangeText={(text) =>
              setAge(text.replace(/[^0-9]/g, '').slice(0, 3))
            }
            keyboardType="number-pad"
            maxLength={3}
          />

          <Text style={styles.fieldLabel}>{t('health.gender')}</Text>
          {renderGenderSelector()}

          <Text style={styles.fieldLabel}>{t('health.blood_group')}</Text>
          {renderBloodGroupSelector()}
        </Card>

        <Card style={styles.section}>
          <Input
            label={t('health.allergies')}
            placeholder="e.g., Penicillin, Peanuts"
            value={allergies}
            onChangeText={setAllergies}
            multiline
          />
          <Input
            label={t('health.conditions')}
            placeholder="e.g., Diabetes, Hypertension"
            value={conditions}
            onChangeText={setConditions}
            multiline
          />
        </Card>

        <Button
          title={t('health_setup.complete')}
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
        />
        <Button
          title={t('abha.skip')}
          onPress={handleSkip}
          variant="text"
          style={styles.skipButton}
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
  header: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  section: {
    marginHorizontal: spacing.md,
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
  saveButton: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  skipButton: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
});

export default HealthProfileSetupScreen;
