import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: '\u0939\u093F\u0928\u094D\u0926\u0940' },
  { code: 'ta', label: '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD' },
  { code: 'te', label: '\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41' },
  { code: 'kn', label: '\u0C95\u0CA8\u0CCD\u0CA8\u0CA1' },
];

const ProfileScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);

  const currentLanguage = languages.find((l) => l.code === i18n.language);

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    setShowLanguageDropdown(false);
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logout_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('profile.title')}</Text>

        {/* User Info */}
        <Card style={styles.section}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('profile.name')}</Text>
            <Text style={styles.infoValue}>{user?.name || '-'}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('profile.phone')}</Text>
            <Text style={styles.infoValue}>{user?.phone || '-'}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('profile.email')}</Text>
            <Text style={styles.infoValue}>{user?.email || '-'}</Text>
          </View>
        </Card>

        {/* Language Selector (Dropdown) */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setShowLanguageDropdown(!showLanguageDropdown)}
          >
            <Text style={styles.dropdownValue}>
              {currentLanguage?.label || 'English'}
            </Text>
            <Text style={styles.dropdownArrow}>
              {showLanguageDropdown ? '\u25B2' : '\u25BC'}
            </Text>
          </TouchableOpacity>

          {showLanguageDropdown && (
            <View style={styles.dropdownMenu}>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.dropdownItem,
                    i18n.language === lang.code && styles.dropdownItemActive,
                  ]}
                  onPress={() => handleLanguageChange(lang.code)}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      i18n.language === lang.code &&
                        styles.dropdownItemTextActive,
                    ]}
                  >
                    {lang.label}
                  </Text>
                  {i18n.language === lang.code && (
                    <Text style={styles.checkmark}>{'\u2713'}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        {/* Notification Preferences */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.notifications')}</Text>

          <View style={styles.notificationRow}>
            <Text style={styles.notificationLabel}>
              {t('profile.push_notifications')}
            </Text>
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={
                pushNotifications ? colors.primary : colors.textTertiary
              }
            />
          </View>
          <View style={styles.divider} />

          <View style={styles.notificationRow}>
            <Text style={styles.notificationLabel}>
              {t('profile.sms_notifications')}
            </Text>
            <Switch
              value={smsNotifications}
              onValueChange={setSmsNotifications}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={
                smsNotifications ? colors.primary : colors.textTertiary
              }
            />
          </View>
          <View style={styles.divider} />

          <View style={styles.notificationRow}>
            <Text style={styles.notificationLabel}>
              {t('profile.email_notifications')}
            </Text>
            <Switch
              value={emailNotifications}
              onValueChange={setEmailNotifications}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={
                emailNotifications ? colors.primary : colors.textTertiary
              }
            />
          </View>
        </Card>

        {/* App Info */}
        <Card style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('profile.app_version')}</Text>
            <Text style={styles.infoValue}>0.1.0</Text>
          </View>
        </Card>

        {/* Logout */}
        <Button
          title={t('profile.logout')}
          onPress={handleLogout}
          variant="outline"
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
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.displaySmall,
    color: colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  // Dropdown
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
  },
  dropdownValue: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  dropdownArrow: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  dropdownMenu: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  dropdownItemActive: {
    backgroundColor: colors.primaryLight,
  },
  dropdownItemText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  checkmark: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  // Notifications
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  notificationLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  logoutButton: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderColor: colors.error,
  },
  logoutText: {
    color: colors.error,
  },
});

export default ProfileScreen;
