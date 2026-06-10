import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../components/design/theme';
import { useTheme } from '../hooks/useTheme';
import { getCurrentUser, signOutUser, updateUserProfile } from '../services/firebase';
import { useUserStore } from '../stores/userStore';
import { sanitizeInput } from '../utils/sanitize';

/** A titled card section. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </Text>
      <View className="overflow-hidden rounded-2xl border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark">
        {children}
      </View>
    </View>
  );
}

/** A single settings row with optional right content. */
function Row({
  icon,
  label,
  right,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  right?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center px-3 py-3.5 ${
        last ? '' : 'border-b border-border-light dark:border-border-dark'
      }`}
    >
      <Ionicons name={icon} size={19} color={COLORS.brand} />
      <Text className="ml-3 flex-1 text-sm text-gray-900 dark:text-white">{label}</Text>
      {right}
    </View>
  );
}

/**
 * Settings screen — appearance (dark mode), edit profile, preferences,
 * account, and sign out.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const togglePWDMode = useUserStore((s) => s.togglePWDMode);
  const signOutStore = useUserStore((s) => s.signOut);

  const [name, setName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [notifications, setNotifications] = useState(user?.preferences.notifications ?? true);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState(false);

  const pwd = user?.pwdMode ?? false;

  /** Save name + bio + notifications to Firestore + store. */
  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const cleanName = sanitizeInput(name, 40) || user.displayName;
      const cleanBio = sanitizeInput(bio, 150);
      const nextPrefs = { ...user.preferences, notifications };
      const fbUser = getCurrentUser();
      if (fbUser) {
        await updateUserProfile(fbUser.uid, {
          displayName: cleanName,
          bio: cleanBio,
          preferences: nextPrefs,
        });
      }
      setUser({ ...user, displayName: cleanName, bio: cleanBio, preferences: nextPrefs });
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 1800);
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [user, name, bio, notifications, setUser]);

  /** Sign out with confirmation. */
  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutUser();
          } catch {
            /* still clear local state */
          }
          signOutStore();
          router.replace('/auth/login');
        },
      },
    ]);
  }, [signOutStore, router]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg dark:bg-surface-dark">
      {/* Header */}
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          testID="settings_back"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark"
        >
          <Ionicons name="arrow-back" size={20} className="text-gray-900 dark:text-white" />
        </Pressable>
        <Text className="ml-2 text-lg font-bold text-gray-900 dark:text-white">Settings</Text>
      </View>

      <ScrollView
        testID="settings_scroll"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Appearance */}
        <Section title="Appearance">
          <Row
            icon="moon"
            label="Dark mode"
            last
            right={
              <Switch
                testID="settings_dark_toggle"
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#D1D5DB', true: COLORS.brand }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </Section>

        {/* Edit profile */}
        <Section title="Edit profile">
          <View className="px-3 py-3 border-b border-border-light dark:border-border-dark">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">Name</Text>
            <TextInput
              testID="settings_name_input"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
              maxLength={40}
              className="text-sm text-gray-900 dark:text-white"
            />
          </View>
          <View className="px-3 py-3">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">Bio</Text>
            <TextInput
              testID="settings_bio_input"
              value={bio}
              onChangeText={setBio}
              placeholder="A short bio…"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={150}
              className="min-h-[44px] text-sm text-gray-900 dark:text-white"
            />
          </View>
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <Row
            icon="notifications"
            label="Notifications"
            right={
              <Switch
                testID="settings_notifications_toggle"
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: '#D1D5DB', true: COLORS.brand }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <Row
            icon="accessibility"
            label="PWD Mode (2× coins)"
            last
            right={
              <Switch
                testID="settings_pwdmode_toggle"
                value={pwd}
                onValueChange={() => togglePWDMode()}
                trackColor={{ false: '#D1D5DB', true: COLORS.aHigh }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </Section>

        {/* Save */}
        <Pressable
          testID="settings_save_button"
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          className={`mb-5 h-12 flex-row items-center justify-center rounded-2xl bg-primary ${
            saving ? 'opacity-70' : ''
          }`}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name={savedHint ? 'checkmark' : 'save-outline'} size={18} color="#FFFFFF" />
              <Text className="ml-2 text-base font-semibold text-white">
                {savedHint ? 'Saved' : 'Save changes'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Account */}
        <Section title="Account">
          <Row
            icon="mail-outline"
            label={user?.email ?? 'Guest account'}
            last
            right={
              <MaterialCommunityIcons name="check-decagram" size={18} color={COLORS.verify} />
            }
          />
        </Section>

        {/* Sign out */}
        <Pressable
          testID="settings_signout_button"
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          className="h-12 flex-row items-center justify-center rounded-2xl border-2 border-danger bg-surface-light dark:bg-surface-dark"
        >
          <Ionicons name="log-out-outline" size={18} color="#E5484D" />
          <Text className="ml-2 text-base font-semibold text-danger">Sign out</Text>
        </Pressable>

        <Text className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          DISCOVA · v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
