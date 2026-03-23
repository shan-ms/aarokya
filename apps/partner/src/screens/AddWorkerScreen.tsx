import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Worker } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { searchWorker, addWorker } from '../api/workers';
import { useAuthStore } from '../store/authStore';
import { usePartnerStore } from '../store/partnerStore';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Card from '../components/common/Card';

interface AddWorkerScreenProps {
  navigation: { goBack: () => void };
}

type SearchMode = 'phone' | 'abha';

const AddWorkerScreen: React.FC<AddWorkerScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const partner = useAuthStore((state) => state.partner);
  const fetchWorkers = usePartnerStore((state) => state.fetchWorkers);

  const [searchMode, setSearchMode] = useState<SearchMode>('phone');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [foundWorker, setFoundWorker] = useState<Worker | null>(null);
  const [searchDone, setSearchDone] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setFoundWorker(null);
    setSearchDone(false);
    try {
      const searchQuery = searchMode === 'phone' ? `+91${query.replace(/\D/g, '')}` : query.trim();
      const response = await searchWorker(searchQuery);
      setFoundWorker(response.data);
      setSearchDone(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      Alert.alert(t('common.error'), message);
    } finally {
      setSearching(false);
    }
  };

  const handleEnroll = async () => {
    if (!foundWorker || !partner?.id) return;

    setEnrolling(true);
    try {
      const payload =
        searchMode === 'phone'
          ? { phone: foundWorker.phone }
          : { abhaId: foundWorker.abhaId };
      await addWorker(partner.id, payload);
      Alert.alert(t('addWorker.enrollSuccess'), '', [
        {
          text: t('common.done'),
          onPress: () => {
            fetchWorkers(partner.id);
            navigation.goBack();
          },
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enrollment failed';
      Alert.alert(t('common.error'), message);
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('addWorker.title')}</Text>
          <Text style={styles.subtitle}>{t('addWorker.subtitle')}</Text>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeTab, searchMode === 'phone' && styles.modeTabActive]}
            onPress={() => {
              setSearchMode('phone');
              setQuery('');
              setFoundWorker(null);
              setSearchDone(false);
            }}
          >
            <Text
              style={[
                styles.modeTabText,
                searchMode === 'phone' && styles.modeTabTextActive,
              ]}
            >
              {t('addWorker.searchByPhone')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, searchMode === 'abha' && styles.modeTabActive]}
            onPress={() => {
              setSearchMode('abha');
              setQuery('');
              setFoundWorker(null);
              setSearchDone(false);
            }}
          >
            <Text
              style={[
                styles.modeTabText,
                searchMode === 'abha' && styles.modeTabTextActive,
              ]}
            >
              {t('addWorker.searchByAbha')}
            </Text>
          </TouchableOpacity>
        </View>

        <Input
          placeholder={
            searchMode === 'phone'
              ? t('addWorker.phonePlaceholder')
              : t('addWorker.abhaPlaceholder')
          }
          keyboardType={searchMode === 'phone' ? 'phone-pad' : 'default'}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setFoundWorker(null);
            setSearchDone(false);
          }}
          leftIcon={
            searchMode === 'phone' ? (
              <Text style={styles.prefix}>+91</Text>
            ) : undefined
          }
        />

        <Button
          title={t('common.search')}
          onPress={handleSearch}
          loading={searching}
          disabled={!query.trim()}
          variant="outline"
          size="md"
          style={styles.searchButton}
        />

        {searchDone && foundWorker && (
          <Card style={styles.resultCard}>
            <Text style={styles.resultLabel}>{t('addWorker.workerFound')}</Text>
            <View style={styles.workerPreview}>
              <View style={styles.workerAvatar}>
                <Text style={styles.workerAvatarText}>
                  {foundWorker.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>{foundWorker.name}</Text>
                <Text style={styles.workerPhone}>{foundWorker.phone}</Text>
                {foundWorker.abhaId && (
                  <Text style={styles.workerAbha}>
                    ABHA: {foundWorker.abhaId}
                  </Text>
                )}
              </View>
            </View>
            <Button
              title={t('addWorker.enrollWorker')}
              onPress={handleEnroll}
              loading={enrolling}
              size="lg"
              style={styles.enrollButton}
            />
          </Card>
        )}

        {searchDone && !foundWorker && (
          <Card style={styles.notFoundCard}>
            <Text style={styles.notFoundText}>
              {t('addWorker.workerNotFound')}
            </Text>
          </Card>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  modeRow: {
    flexDirection: 'row',
    marginBottom: spacing.xxl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.divider,
    padding: spacing.xs,
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  modeTabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeTabText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeTabTextActive: {
    color: colors.primary,
  },
  prefix: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  searchButton: {
    marginBottom: spacing.xxl,
  },
  resultCard: {
    marginTop: spacing.md,
  },
  resultLabel: {
    ...typography.label,
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  workerPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  workerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  workerAvatarText: {
    ...typography.headlineLarge,
    color: colors.primary,
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  workerPhone: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  workerAbha: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  enrollButton: {
    width: '100%',
  },
  notFoundCard: {
    marginTop: spacing.md,
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  notFoundText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

export default AddWorkerScreen;
