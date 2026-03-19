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
  listDocuments,
  createDocument,
  deleteDocument,
  shareDocument,
  listShared,
} from '../api/documents';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { HealthDocument, RecordShare } from '../types';

type FilterTab = 'all' | 'prescription' | 'lab_report' | 'discharge_summary' | 'other';

const FILTER_TABS: Array<{ key: FilterTab; labelKey: string }> = [
  { key: 'all', labelKey: 'records.filter_all' },
  { key: 'prescription', labelKey: 'records.filter_prescriptions' },
  { key: 'lab_report', labelKey: 'records.filter_lab_reports' },
  { key: 'discharge_summary', labelKey: 'records.filter_discharge' },
  { key: 'other', labelKey: 'records.filter_other' },
];

const DOCUMENT_TYPES = [
  { value: 'prescription', labelKey: 'records.type_prescription' },
  { value: 'lab_report', labelKey: 'records.type_lab_report' },
  { value: 'discharge_summary', labelKey: 'records.type_discharge' },
  { value: 'other', labelKey: 'records.type_other' },
];

const EXPIRY_OPTIONS = [
  { value: 24, labelKey: 'records.expiry_24h' },
  { value: 72, labelKey: 'records.expiry_3d' },
  { value: 168, labelKey: 'records.expiry_7d' },
  { value: 720, labelKey: 'records.expiry_30d' },
];

const getDocumentIcon = (type: string): string => {
  switch (type) {
    case 'prescription':
      return 'Rx';
    case 'lab_report':
      return 'Lab';
    case 'discharge_summary':
      return 'DC';
    default:
      return 'Doc';
  }
};

const RecordsVaultScreen: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<HealthDocument | null>(null);

  // Add document form state
  const [newDocType, setNewDocType] = useState('prescription');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');

  // Share form state
  const [shareWith, setShareWith] = useState('');
  const [sharePurpose, setSharePurpose] = useState('');
  const [shareExpiry, setShareExpiry] = useState(72);

  const {
    data: documentsData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ data: HealthDocument[] }>({
    queryKey: ['documents'],
    queryFn: listDocuments,
  });

  const { data: sharedData } = useQuery<{ data: RecordShare[] }>({
    queryKey: ['documents-shared'],
    queryFn: listShared,
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createDocument>[0]) => createDocument(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setShowAddModal(false);
      resetAddForm();
    },
    onError: () => {
      Alert.alert(t('common.error'), t('records.create_error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setShowDetailModal(false);
      setSelectedDocument(null);
    },
    onError: () => {
      Alert.alert(t('common.error'), t('records.delete_error'));
    },
  });

  const shareMutation = useMutation({
    mutationFn: (data: Parameters<typeof shareDocument>[0]) => shareDocument(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-shared'] });
      setShowShareModal(false);
      resetShareForm();
      Alert.alert(t('records.share_success_title'), t('records.share_success_message'));
    },
    onError: () => {
      Alert.alert(t('common.error'), t('records.share_error'));
    },
  });

  const resetAddForm = useCallback(() => {
    setNewDocType('prescription');
    setNewTitle('');
    setNewDescription('');
    setNewTags('');
  }, []);

  const resetShareForm = useCallback(() => {
    setShareWith('');
    setSharePurpose('');
    setShareExpiry(72);
  }, []);

  const documents = documentsData?.data ?? [];
  const sharingHistory = sharedData?.data ?? [];

  const filteredDocuments = activeFilter === 'all'
    ? documents
    : documents.filter((doc) => doc.documentType === activeFilter);

  const handleAddDocument = useCallback(() => {
    if (!newTitle.trim()) {
      return;
    }
    const tags = newTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    createMutation.mutate({
      document_type: newDocType,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  }, [newDocType, newTitle, newDescription, newTags, createMutation]);

  const handleDocumentPress = useCallback((doc: HealthDocument) => {
    setSelectedDocument(doc);
    setShowDetailModal(true);
  }, []);

  const handleDeleteDocument = useCallback(() => {
    if (!selectedDocument) return;
    Alert.alert(
      t('records.delete_confirm_title'),
      t('records.delete_confirm_message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(selectedDocument.id),
        },
      ],
    );
  }, [selectedDocument, deleteMutation, t]);

  const handleShareDocument = useCallback(() => {
    if (!selectedDocument || !shareWith.trim()) return;
    shareMutation.mutate({
      document_id: selectedDocument.id,
      shared_with: shareWith.trim(),
      purpose: sharePurpose.trim() || undefined,
      expires_in_hours: shareExpiry,
    });
  }, [selectedDocument, shareWith, sharePurpose, shareExpiry, shareMutation]);

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const renderDocumentItem = ({ item }: { item: HealthDocument }) => (
    <TouchableOpacity onPress={() => handleDocumentPress(item)} activeOpacity={0.7}>
      <Card style={styles.documentCard}>
        <View style={styles.documentRow}>
          <View style={styles.documentIcon}>
            <Text style={styles.documentIconText}>{getDocumentIcon(item.documentType)}</Text>
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.documentDate}>{formatDate(item.createdAt)}</Text>
            {item.tags && item.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {item.tags.slice(0, 3).map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <EmptyState
      title={t('records.empty_title')}
      subtitle={t('records.empty_subtitle')}
      action={
        <Button
          title={t('records.add_document')}
          onPress={() => setShowAddModal(true)}
          variant="primary"
        />
      }
    />
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('records.title')}</Text>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          style={styles.addButton}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              activeFilter === tab.key && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredDocuments}
        keyExtractor={(item) => item.id}
        renderItem={renderDocumentItem}
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
        ListFooterComponent={
          sharingHistory.length > 0 ? (
            <View style={styles.sharingSection}>
              <Text style={styles.sectionTitle}>{t('records.sharing_history')}</Text>
              {sharingHistory.map((share) => (
                <Card key={share.id} style={styles.shareCard}>
                  <Text style={styles.shareWith}>{share.sharedWith}</Text>
                  {share.purpose && (
                    <Text style={styles.sharePurpose}>{share.purpose}</Text>
                  )}
                  <Text style={styles.shareDate}>{formatDate(share.sharedAt)}</Text>
                  {share.revokedAt && (
                    <Text style={styles.shareRevoked}>{t('records.revoked')}</Text>
                  )}
                </Card>
              ))}
            </View>
          ) : null
        }
      />

      {/* Add Document Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('records.add_document')}</Text>
            <TouchableOpacity onPress={() => { setShowAddModal(false); resetAddForm(); }}>
              <Text style={styles.modalClose}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.fieldLabel}>{t('records.document_type')}</Text>
            <View style={styles.typePickerRow}>
              {DOCUMENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typePicker,
                    newDocType === type.value && styles.typePickerSelected,
                  ]}
                  onPress={() => setNewDocType(type.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.typePickerText,
                      newDocType === type.value && styles.typePickerTextSelected,
                    ]}
                  >
                    {t(type.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label={t('records.title_label')}
              placeholder={t('records.title_placeholder')}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Input
              label={t('records.description_label')}
              placeholder={t('records.description_placeholder')}
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
              numberOfLines={3}
            />

            <Input
              label={t('records.tags_label')}
              placeholder={t('records.tags_placeholder')}
              value={newTags}
              onChangeText={setNewTags}
            />

            <Button
              title={t('records.save_document')}
              onPress={handleAddDocument}
              variant="primary"
              loading={createMutation.isPending}
              disabled={!newTitle.trim()}
              style={styles.modalButton}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedDocument?.title}</Text>
            <TouchableOpacity onPress={() => { setShowDetailModal(false); setSelectedDocument(null); }}>
              <Text style={styles.modalClose}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
          {selectedDocument && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('records.document_type')}</Text>
                <Text style={styles.detailValue}>{selectedDocument.documentType}</Text>
              </View>
              {selectedDocument.description && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('records.description_label')}</Text>
                  <Text style={styles.detailValue}>{selectedDocument.description}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('records.date_label')}</Text>
                <Text style={styles.detailValue}>{formatDate(selectedDocument.createdAt)}</Text>
              </View>
              {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('records.tags_label')}</Text>
                  <View style={styles.tagsRow}>
                    {selectedDocument.tags.map((tag, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.detailActions}>
                <Button
                  title={t('records.share')}
                  onPress={() => {
                    setShowDetailModal(false);
                    setShowShareModal(true);
                  }}
                  variant="primary"
                  style={styles.detailActionButton}
                />
                <Button
                  title={t('records.delete')}
                  onPress={handleDeleteDocument}
                  variant="outline"
                  loading={deleteMutation.isPending}
                  style={styles.detailActionButton}
                />
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Share Modal */}
      <Modal visible={showShareModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('records.share_document')}</Text>
            <TouchableOpacity onPress={() => { setShowShareModal(false); resetShareForm(); }}>
              <Text style={styles.modalClose}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Input
              label={t('records.share_with_label')}
              placeholder={t('records.share_with_placeholder')}
              value={shareWith}
              onChangeText={setShareWith}
            />

            <Input
              label={t('records.share_purpose_label')}
              placeholder={t('records.share_purpose_placeholder')}
              value={sharePurpose}
              onChangeText={setSharePurpose}
            />

            <Text style={styles.fieldLabel}>{t('records.share_expiry_label')}</Text>
            <View style={styles.expiryRow}>
              {EXPIRY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.expiryOption,
                    shareExpiry === opt.value && styles.expiryOptionSelected,
                  ]}
                  onPress={() => setShareExpiry(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.expiryOptionText,
                      shareExpiry === opt.value && styles.expiryOptionTextSelected,
                    ]}
                  >
                    {t(opt.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title={t('records.share_now')}
              onPress={handleShareDocument}
              variant="primary"
              loading={shareMutation.isPending}
              disabled={!shareWith.trim()}
              style={styles.modalButton}
            />
          </ScrollView>
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
  filterContainer: {
    maxHeight: 44,
  },
  filterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filterTab: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.surface,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  documentCard: {
    marginBottom: spacing.sm,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  documentIconText: {
    ...typography.label,
    color: colors.primary,
    fontWeight: '700',
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  documentDate: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tag: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accentLight,
  },
  tagText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '500',
  },
  sharingSection: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
    marginTop: 2,
  },
  shareRevoked: {
    ...typography.label,
    color: colors.error,
    marginTop: spacing.xs,
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
  typePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typePicker: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typePickerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  typePickerText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  typePickerTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  expiryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  expiryOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  expiryOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  expiryOptionText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  expiryOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  detailRow: {
    marginBottom: spacing.md,
  },
  detailLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  detailValue: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  detailActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  detailActionButton: {
    width: '100%',
  },
});

export default RecordsVaultScreen;
