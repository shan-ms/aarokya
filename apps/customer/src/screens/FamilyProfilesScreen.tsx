import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  listFamilyMembers,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
} from '../api/family';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { FamilyMember } from '../types';

const RELATIONSHIPS = [
  { value: 'spouse', labelKey: 'family.rel_spouse' },
  { value: 'child', labelKey: 'family.rel_child' },
  { value: 'parent', labelKey: 'family.rel_parent' },
  { value: 'sibling', labelKey: 'family.rel_sibling' },
  { value: 'other', labelKey: 'family.rel_other' },
];

const GENDERS = [
  { value: 'male', labelKey: 'family.gender_male' },
  { value: 'female', labelKey: 'family.gender_female' },
  { value: 'other', labelKey: 'family.gender_other' },
];

const FamilyProfilesScreen: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  // Form state
  const [memberName, setMemberName] = useState('');
  const [relationship, setRelationship] = useState('spouse');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  const {
    data: membersData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ data: FamilyMember[] }>({
    queryKey: ['family-members'],
    queryFn: listFamilyMembers,
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createFamilyMember>[0]) => createFamilyMember(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      setShowAddModal(false);
      resetForm();
    },
    onError: () => {
      Alert.alert(t('common.error'), t('family.create_error'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateFamilyMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      setShowEditModal(false);
      setSelectedMember(null);
      resetForm();
    },
    onError: () => {
      Alert.alert(t('common.error'), t('family.update_error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFamilyMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      setShowDetailModal(false);
      setSelectedMember(null);
    },
    onError: () => {
      Alert.alert(t('common.error'), t('family.delete_error'));
    },
  });

  const members = membersData?.data ?? [];

  const resetForm = useCallback(() => {
    setMemberName('');
    setRelationship('spouse');
    setDateOfBirth('');
    setGender('');
    setBloodGroup('');
    setAllergies('');
    setConditions('');
    setEmergencyContact('');
  }, []);

  const populateForm = useCallback((member: FamilyMember) => {
    setMemberName(member.memberName);
    setRelationship(member.relationship);
    setDateOfBirth(member.dateOfBirth ?? '');
    setGender(member.gender ?? '');
    setBloodGroup(member.bloodGroup ?? '');
    setAllergies(member.allergies?.join(', ') ?? '');
    setConditions(member.chronicConditions?.join(', ') ?? '');
    setEmergencyContact(member.emergencyContact ?? '');
  }, []);

  const buildFormData = useCallback(() => {
    const allergyList = allergies
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    const conditionList = conditions
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    return {
      member_name: memberName.trim(),
      relationship,
      date_of_birth: dateOfBirth.trim() || undefined,
      gender: gender || undefined,
      blood_group: bloodGroup.trim() || undefined,
      allergies: allergyList.length > 0 ? allergyList : undefined,
      chronic_conditions: conditionList.length > 0 ? conditionList : undefined,
      emergency_contact: emergencyContact.trim() || undefined,
    };
  }, [memberName, relationship, dateOfBirth, gender, bloodGroup, allergies, conditions, emergencyContact]);

  const handleCreate = useCallback(() => {
    if (!memberName.trim()) return;
    createMutation.mutate(buildFormData());
  }, [memberName, buildFormData, createMutation]);

  const handleUpdate = useCallback(() => {
    if (!selectedMember || !memberName.trim()) return;
    const data = buildFormData();
    updateMutation.mutate({ id: selectedMember.id, data });
  }, [selectedMember, memberName, buildFormData, updateMutation]);

  const handleDelete = useCallback(() => {
    if (!selectedMember) return;
    Alert.alert(
      t('family.delete_confirm_title'),
      t('family.delete_confirm_message', { name: selectedMember.memberName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(selectedMember.id),
        },
      ],
    );
  }, [selectedMember, deleteMutation, t]);

  const handleMemberPress = useCallback((member: FamilyMember) => {
    setSelectedMember(member);
    setShowDetailModal(true);
  }, []);

  const handleEditPress = useCallback(() => {
    if (!selectedMember) return;
    populateForm(selectedMember);
    setShowDetailModal(false);
    setShowEditModal(true);
  }, [selectedMember, populateForm]);

  const renderMemberItem = ({ item }: { item: FamilyMember }) => (
    <TouchableOpacity onPress={() => handleMemberPress(item)} activeOpacity={0.7}>
      <Card style={styles.memberCard}>
        <View style={styles.memberRow}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>
              {item.memberName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.memberName}</Text>
            <Text style={styles.memberRelationship}>{item.relationship}</Text>
            {item.bloodGroup && (
              <Text style={styles.memberDetail}>
                {t('family.blood_group_label')}: {item.bloodGroup}
              </Text>
            )}
            {item.allergies && item.allergies.length > 0 && (
              <Text style={styles.memberDetail} numberOfLines={1}>
                {t('family.allergies_label')}: {item.allergies.join(', ')}
              </Text>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <EmptyState
      title={t('family.empty_title')}
      subtitle={t('family.empty_subtitle')}
      action={
        <Button
          title={t('family.add_member')}
          onPress={() => setShowAddModal(true)}
          variant="primary"
        />
      }
    />
  );

  const renderForm = (isEdit: boolean) => (
    <ScrollView contentContainerStyle={styles.modalContent}>
      <Input
        label={t('family.name_label')}
        placeholder={t('family.name_placeholder')}
        value={memberName}
        onChangeText={setMemberName}
      />

      <Text style={styles.fieldLabel}>{t('family.relationship_label')}</Text>
      <View style={styles.pickerRow}>
        {RELATIONSHIPS.map((rel) => (
          <TouchableOpacity
            key={rel.value}
            style={[
              styles.pickerOption,
              relationship === rel.value && styles.pickerOptionSelected,
            ]}
            onPress={() => setRelationship(rel.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.pickerOptionText,
                relationship === rel.value && styles.pickerOptionTextSelected,
              ]}
            >
              {t(rel.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Input
        label={t('family.dob_label')}
        placeholder={t('family.dob_placeholder')}
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
      />

      <Text style={styles.fieldLabel}>{t('family.gender_label')}</Text>
      <View style={styles.pickerRow}>
        {GENDERS.map((g) => (
          <TouchableOpacity
            key={g.value}
            style={[
              styles.pickerOption,
              gender === g.value && styles.pickerOptionSelected,
            ]}
            onPress={() => setGender(g.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.pickerOptionText,
                gender === g.value && styles.pickerOptionTextSelected,
              ]}
            >
              {t(g.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Input
        label={t('family.blood_group_label')}
        placeholder={t('family.blood_group_placeholder')}
        value={bloodGroup}
        onChangeText={setBloodGroup}
      />

      <Input
        label={t('family.allergies_label')}
        placeholder={t('family.allergies_placeholder')}
        value={allergies}
        onChangeText={setAllergies}
      />

      <Input
        label={t('family.conditions_label')}
        placeholder={t('family.conditions_placeholder')}
        value={conditions}
        onChangeText={setConditions}
      />

      <Input
        label={t('family.emergency_contact_label')}
        placeholder={t('family.emergency_contact_placeholder')}
        value={emergencyContact}
        onChangeText={setEmergencyContact}
        keyboardType="phone-pad"
      />

      <Button
        title={isEdit ? t('family.save_changes') : t('family.add_member')}
        onPress={isEdit ? handleUpdate : handleCreate}
        variant="primary"
        loading={isEdit ? updateMutation.isPending : createMutation.isPending}
        disabled={!memberName.trim()}
        style={styles.modalButton}
      />
    </ScrollView>
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('family.title')}</Text>
        <TouchableOpacity
          onPress={() => { resetForm(); setShowAddModal(true); }}
          style={styles.addButton}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={renderMemberItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Add Member Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('family.add_member')}</Text>
            <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
              <Text style={styles.modalClose}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          {renderForm(false)}
        </SafeAreaView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedMember?.memberName}</Text>
            <TouchableOpacity onPress={() => { setShowDetailModal(false); setSelectedMember(null); }}>
              <Text style={styles.modalClose}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
          {selectedMember && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.detailSection}>
                <View style={styles.detailAvatarLarge}>
                  <Text style={styles.detailAvatarText}>
                    {selectedMember.memberName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.detailName}>{selectedMember.memberName}</Text>
                <Text style={styles.detailRelationship}>{selectedMember.relationship}</Text>
              </View>

              {selectedMember.dateOfBirth && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('family.dob_label')}</Text>
                  <Text style={styles.detailValue}>{selectedMember.dateOfBirth}</Text>
                </View>
              )}
              {selectedMember.gender && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('family.gender_label')}</Text>
                  <Text style={styles.detailValue}>{selectedMember.gender}</Text>
                </View>
              )}
              {selectedMember.bloodGroup && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('family.blood_group_label')}</Text>
                  <Text style={styles.detailValue}>{selectedMember.bloodGroup}</Text>
                </View>
              )}
              {selectedMember.allergies && selectedMember.allergies.length > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('family.allergies_label')}</Text>
                  <Text style={styles.detailValue}>{selectedMember.allergies.join(', ')}</Text>
                </View>
              )}
              {selectedMember.chronicConditions && selectedMember.chronicConditions.length > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('family.conditions_label')}</Text>
                  <Text style={styles.detailValue}>{selectedMember.chronicConditions.join(', ')}</Text>
                </View>
              )}
              {selectedMember.emergencyContact && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('family.emergency_contact_label')}</Text>
                  <Text style={styles.detailValue}>{selectedMember.emergencyContact}</Text>
                </View>
              )}

              <View style={styles.detailActions}>
                <Button
                  title={t('family.edit')}
                  onPress={handleEditPress}
                  variant="primary"
                  style={styles.detailActionButton}
                />
                <Button
                  title={t('family.delete')}
                  onPress={handleDelete}
                  variant="outline"
                  loading={deleteMutation.isPending}
                  style={styles.detailActionButton}
                  textStyle={styles.deleteButtonText}
                />
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('family.edit_member')}</Text>
            <TouchableOpacity onPress={() => { setShowEditModal(false); resetForm(); }}>
              <Text style={styles.modalClose}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          {renderForm(true)}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.surface,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  memberCard: {
    marginBottom: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  memberAvatarText: {
    ...typography.headlineSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  memberRelationship: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  memberDetail: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    flex: 1,
  },
  modalClose: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.md,
  },
  modalContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  modalButton: {
    marginTop: spacing.lg,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pickerOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pickerOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pickerOptionText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  pickerOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  // Detail styles
  detailSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  detailAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  detailAvatarText: {
    ...typography.displaySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  detailName: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
  },
  detailRelationship: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginTop: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailLabel: {
    ...typography.label,
    color: colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
  detailActions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  detailActionButton: {
    width: '100%',
  },
  deleteButtonText: {
    color: colors.error,
  },
});

export default FamilyProfilesScreen;
