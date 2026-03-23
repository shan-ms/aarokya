import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';

interface VerificationScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
  route: {
    params: {
      phone: string;
      partnerType: string;
      businessName: string;
      registrationNumber: string;
    };
  };
}

type DocumentType = 'gst' | 'pan';
type UploadStatus = 'pending' | 'uploaded' | 'verified' | 'rejected';

interface DocumentState {
  type: DocumentType;
  label: string;
  placeholder: string;
  status: UploadStatus;
  fileName: string | null;
}

const getStatusInfo = (
  status: UploadStatus,
): { label: string; color: string; bg: string } => {
  switch (status) {
    case 'verified':
      return { label: 'Verified', color: colors.success, bg: colors.secondaryLight };
    case 'uploaded':
      return { label: 'Under Review', color: colors.accent, bg: colors.accentLight };
    case 'rejected':
      return { label: 'Rejected', color: colors.error, bg: colors.errorLight };
    case 'pending':
    default:
      return { label: 'Pending Upload', color: colors.textTertiary, bg: colors.divider };
  }
};

const VerificationScreen: React.FC<VerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const { phone, partnerType, businessName, registrationNumber } = route.params;

  const [documents, setDocuments] = useState<DocumentState[]>([
    {
      type: 'gst',
      label: t('verification.gstCertificate'),
      placeholder: t('verification.gstPlaceholder'),
      status: 'pending',
      fileName: null,
    },
    {
      type: 'pan',
      label: t('verification.panCard'),
      placeholder: t('verification.panPlaceholder'),
      status: 'pending',
      fileName: null,
    },
  ]);
  const [uploading, setUploading] = useState<DocumentType | null>(null);

  const handleUpload = async (docType: DocumentType) => {
    setUploading(docType);
    // Simulate document picker and upload
    setTimeout(() => {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.type === docType
            ? {
                ...doc,
                status: 'uploaded' as UploadStatus,
                fileName:
                  docType === 'gst'
                    ? 'GST_Certificate.pdf'
                    : 'PAN_Card.pdf',
              }
            : doc,
        ),
      );
      setUploading(null);
    }, 1500);
  };

  const handleContinue = () => {
    navigation.navigate('ContributionScheme', {
      phone,
      partnerType,
      businessName,
      registrationNumber,
    });
  };

  const handleSkip = () => {
    Alert.alert(
      t('verification.skipTitle'),
      t('verification.skipMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('verification.skipConfirm'),
          onPress: () => {
            navigation.navigate('ContributionScheme', {
              phone,
              partnerType,
              businessName,
              registrationNumber,
            });
          },
        },
      ],
    );
  };

  const allUploaded = documents.every((doc) => doc.status !== 'pending');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('verification.title')}</Text>
          <Text style={styles.subtitle}>{t('verification.subtitle')}</Text>
        </View>

        <View style={styles.statusOverview}>
          <Card style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusDot}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: allUploaded
                        ? colors.success
                        : colors.warning,
                    },
                  ]}
                />
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>
                  {t('verification.verificationStatus')}
                </Text>
                <Text style={styles.statusDesc}>
                  {allUploaded
                    ? t('verification.allUploaded')
                    : t('verification.pendingDocuments')}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {documents.map((doc) => {
          const statusInfo = getStatusInfo(doc.status);
          const isUploading = uploading === doc.type;
          return (
            <Card key={doc.type} style={styles.documentCard}>
              <View style={styles.documentHeader}>
                <Text style={styles.documentLabel}>{doc.label}</Text>
                <View
                  style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}
                >
                  <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                    {statusInfo.label}
                  </Text>
                </View>
              </View>

              {doc.fileName ? (
                <View style={styles.fileInfo}>
                  <View style={styles.fileIcon}>
                    <Text style={styles.fileIconText}>F</Text>
                  </View>
                  <Text style={styles.fileName}>{doc.fileName}</Text>
                </View>
              ) : (
                <Text style={styles.placeholder}>{doc.placeholder}</Text>
              )}

              {doc.status === 'pending' && (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => handleUpload(doc.type)}
                  disabled={isUploading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.uploadButtonText}>
                    {isUploading
                      ? t('verification.uploading')
                      : t('verification.uploadDocument')}
                  </Text>
                </TouchableOpacity>
              )}

              {doc.status === 'rejected' && (
                <TouchableOpacity
                  style={[styles.uploadButton, styles.reuploadButton]}
                  onPress={() => handleUpload(doc.type)}
                  disabled={isUploading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.uploadButtonText, styles.reuploadButtonText]}>
                    {t('verification.reupload')}
                  </Text>
                </TouchableOpacity>
              )}
            </Card>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t('common.next')}
          onPress={handleContinue}
          disabled={!allUploaded}
          size="lg"
          style={styles.continueButton}
        />
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>{t('verification.skipForNow')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xxl,
    paddingBottom: spacing.huge,
  },
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  statusOverview: {
    marginBottom: spacing.xxl,
  },
  statusCard: {
    backgroundColor: colors.surface,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statusDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  documentCard: {
    marginBottom: spacing.md,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  documentLabel: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  placeholder: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.divider,
    borderRadius: borderRadius.md,
  },
  fileIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  fileIconText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  fileName: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  uploadButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  uploadButtonText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.primary,
  },
  reuploadButton: {
    borderColor: colors.error,
  },
  reuploadButtonText: {
    color: colors.error,
  },
  footer: {
    padding: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  continueButton: {
    width: '100%',
  },
  skipButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  skipText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default VerificationScreen;
