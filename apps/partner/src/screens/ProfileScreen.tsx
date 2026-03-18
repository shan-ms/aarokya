import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { useAuthStore } from '../store/authStore';
import { usePartnerStore } from '../store/partnerStore';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

interface ProfileScreenProps {
  navigation: { navigate: (screen: string) => void };
}

const formatCurrency = (paise: number): string => {
  const rupees = paise / 100;
  return `\u20b9${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatPartnerType = (type: string): string => {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const partner = useAuthStore((state) => state.partner);
  const logout = useAuthStore((state) => state.logout);
  const resetPartnerStore = usePartnerStore((state) => state.reset);

  const handleLogout = () => {
    Alert.alert(t('common.logout'), t('common.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.logout'),
        style: 'destructive',
        onPress: () => {
          resetPartnerStore();
          logout();
        },
      },
    ]);
  };

  if (!partner) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('profile.title')}</Text>

        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {partner.businessName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.businessName}>{partner.businessName}</Text>
          <Text style={styles.phone}>{partner.phone}</Text>
        </View>

        <Card style={styles.detailsCard}>
          <Text style={styles.cardTitle}>{t('profile.businessDetails')}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('profile.businessName')}</Text>
            <Text style={styles.detailValue}>{partner.businessName}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('profile.registrationNumber')}</Text>
            <Text style={styles.detailValue}>{partner.registrationNumber}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('profile.partnerType')}</Text>
            <Text style={styles.detailValue}>
              {formatPartnerType(partner.partnerType)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('profile.contributionScheme')}</Text>
            <Text style={styles.detailValue}>
              {partner.contributionScheme.type === 'per_task'
                ? 'Per Task'
                : 'Monthly Fixed'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('profile.schemeAmount')}</Text>
            <Text style={styles.detailValue}>
              {formatCurrency(partner.contributionScheme.amountPaise)}
              {partner.contributionScheme.type === 'per_task'
                ? ' / task'
                : ' / month'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('profile.memberSince')}</Text>
            <Text style={styles.detailValue}>
              {formatDate(partner.createdAt)}
            </Text>
          </View>
        </Card>

        <Card style={styles.statsCard}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{partner.totalWorkers}</Text>
              <Text style={styles.statLabel}>{t('dashboard.totalWorkers')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {formatCurrency(partner.totalContributedPaise)}
              </Text>
              <Text style={styles.statLabel}>{t('dashboard.totalContributed')}</Text>
            </View>
          </View>
        </Card>

        <Button
          title={t('common.logout')}
          onPress={handleLogout}
          variant="outline"
          size="lg"
          style={styles.logoutButton}
          textStyle={styles.logoutText}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginBottom: spacing.xxl,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  businessName: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  phone: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  detailsCard: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  statsCard: {
    marginBottom: spacing.xxl,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.headlineLarge,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.divider,
  },
  logoutButton: {
    borderColor: colors.error,
  },
  logoutText: {
    color: colors.error,
  },
});

export default ProfileScreen;
