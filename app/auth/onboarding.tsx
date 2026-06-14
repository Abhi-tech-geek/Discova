import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { createUserProfile, getCurrentUser } from '../../services/firebase';
import { createDemoUser, useUserStore } from '../../stores/userStore';
import { sanitizeInput } from '../../utils/sanitize';
import type { DisabilityType } from '../../types';

type Gender = 'male' | 'female' | 'other';

const GENDER_OPTIONS: Array<{ value: Gender; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { value: 'male', label: 'Male', icon: 'gender-male' },
  { value: 'female', label: 'Female', icon: 'gender-female' },
  { value: 'other', label: 'Other', icon: 'account' },
];

/** Auto-format digits into DD/MM/YYYY as the user types. */
function formatDob(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** True when DOB is a real, past date (DD/MM/YYYY) and age is 5-120. */
function isValidDob(dob: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob);
  if (!m) return false;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  if (date.getDate() !== day || date.getMonth() !== month - 1) return false;
  const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
  return age >= 5 && age <= 120;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Static slide content. */
interface Slide {
  key: 'welcome' | 'how' | 'profile';
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    icon: 'map-marker-radius',
    iconColor: '#6366F1',
    title: 'Welcome to Discova',
    description: 'A social map of accessible places, built with the community.',
  },
  {
    key: 'how',
    icon: 'camera-account',
    iconColor: '#EC4899',
    title: 'Post. Rate. Help.',
    description:
      'Share photos of places you visit. Our AI scores accessibility, you confirm what you saw. Earn coins for every contribution.',
  },
  {
    key: 'profile',
    icon: 'account-heart',
    iconColor: '#10B981',
    title: 'Tell us about you',
    description:
      'Letting us know your accessibility needs unlocks personalized picks and the PWD coin multiplier.',
  },
];

/** Disability picker option. */
interface DisabilityOption {
  type: DisabilityType;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}

const DISABILITY_OPTIONS: DisabilityOption[] = [
  { type: 'mobility', label: 'Mobility', icon: 'wheelchair', color: '#6366F1' },
  { type: 'visual', label: 'Visual', icon: 'eye-off-outline', color: '#F59E0B' },
  { type: 'hearing', label: 'Hearing', icon: 'ear-hearing', color: '#10B981' },
  { type: 'cognitive', label: 'Cognitive', icon: 'brain', color: '#EC4899' },
];

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

/** Round dot indicator strip for the FlatList. */
function DotIndicator({ count, activeIndex }: { count: number; activeIndex: number }) {
  return (
    <View
      testID="onboarding_dots"
      className="flex-row items-center justify-center py-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          testID={`onboarding_dot_${i}`}
          className={`mx-1 h-2 rounded-full ${
            i === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-muted-light dark:bg-muted-dark'
          }`}
        />
      ))}
    </View>
  );
}

/** A single onboarding slide (one of three). */
function SlideView({
  slide,
  isPWD,
  setIsPWD,
  selectedDisability,
  setSelectedDisability,
  firstName,
  setFirstName,
  surname,
  setSurname,
  dob,
  setDob,
  gender,
  setGender,
}: {
  slide: Slide;
  isPWD: boolean | null;
  setIsPWD: (value: boolean) => void;
  selectedDisability: DisabilityType | null;
  setSelectedDisability: (type: DisabilityType) => void;
  firstName: string;
  setFirstName: (v: string) => void;
  surname: string;
  setSurname: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  gender: Gender | null;
  setGender: (g: Gender) => void;
}) {
  const isProfileSlide = slide.key === 'profile';

  return (
    <ScrollView
      testID={`onboarding_slide_${slide.key}`}
      style={{ width: SCREEN_WIDTH }}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="items-center">
        <View className="h-24 w-24 items-center justify-center rounded-3xl bg-muted-light dark:bg-muted-dark">
          <MaterialCommunityIcons name={slide.icon} size={56} color={slide.iconColor} />
        </View>
        <Text className="mt-6 text-center text-3xl font-bold text-gray-900 dark:text-white">
          {slide.title}
        </Text>
        <Text className="mt-3 max-w-xs text-center text-base text-gray-600 dark:text-gray-300">
          {slide.description}
        </Text>
      </View>

      {isProfileSlide ? (
        <View className="mt-6">
          {/* Basic info */}
          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Your details
          </Text>
          <View className="flex-row" style={{ gap: 8 }}>
            <TextInput
              testID="onboarding_first_name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor="#9CA3AF"
              maxLength={30}
              autoCapitalize="words"
              className="h-12 flex-1 rounded-xl border border-border-light bg-surface-light px-3 text-sm text-gray-900 dark:border-border-dark dark:bg-surface-dark dark:text-white"
            />
            <TextInput
              testID="onboarding_surname"
              value={surname}
              onChangeText={setSurname}
              placeholder="Surname"
              placeholderTextColor="#9CA3AF"
              maxLength={30}
              autoCapitalize="words"
              className="h-12 flex-1 rounded-xl border border-border-light bg-surface-light px-3 text-sm text-gray-900 dark:border-border-dark dark:bg-surface-dark dark:text-white"
            />
          </View>
          <TextInput
            testID="onboarding_dob"
            value={dob}
            onChangeText={(v) => setDob(formatDob(v))}
            placeholder="Date of birth — DD/MM/YYYY"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            maxLength={10}
            className="mt-2 h-12 rounded-xl border border-border-light bg-surface-light px-3 text-sm text-gray-900 dark:border-border-dark dark:bg-surface-dark dark:text-white"
          />

          {/* Gender */}
          <View className="mt-2 flex-row" style={{ gap: 8 }}>
            {GENDER_OPTIONS.map((g) => {
              const selected = gender === g.value;
              return (
                <Pressable
                  key={g.value}
                  testID={`onboarding_gender_${g.value}`}
                  onPress={() => setGender(g.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className={`h-12 flex-1 flex-row items-center justify-center rounded-xl border-2 ${
                    selected
                      ? 'border-primary bg-primary'
                      : 'border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark'
                  }`}
                >
                  <MaterialCommunityIcons name={g.icon} size={15} color={selected ? '#FFFFFF' : '#6B7280'} />
                  <Text
                    className={`ml-1.5 text-sm font-semibold ${
                      selected ? 'text-white' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mb-3 mt-6 text-center text-sm font-medium text-gray-700 dark:text-gray-200">
            Do you identify as a person with a disability?
          </Text>
          <View className="flex-row justify-center">
            <Pressable
              testID="onboarding_pwd_yes"
              onPress={() => setIsPWD(true)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isPWD === true }}
              className={`mr-2 h-12 w-28 items-center justify-center rounded-xl border-2 ${
                isPWD === true
                  ? 'border-primary bg-primary'
                  : 'border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark'
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  isPWD === true ? 'text-white' : 'text-gray-900 dark:text-white'
                }`}
              >
                Yes
              </Text>
            </Pressable>
            <Pressable
              testID="onboarding_pwd_no"
              onPress={() => setIsPWD(false)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isPWD === false }}
              className={`ml-2 h-12 w-28 items-center justify-center rounded-xl border-2 ${
                isPWD === false
                  ? 'border-primary bg-primary'
                  : 'border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark'
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  isPWD === false ? 'text-white' : 'text-gray-900 dark:text-white'
                }`}
              >
                No
              </Text>
            </Pressable>
          </View>

          {isPWD === true ? (
            <Animated.View
              testID="onboarding_disability_selector"
              entering={FadeInDown.duration(350)}
              exiting={FadeOut.duration(150)}
              className="mt-6"
            >
              <Text className="mb-3 text-center text-sm font-medium text-gray-700 dark:text-gray-200">
                Which best describes your primary need?
              </Text>
              <View className="flex-row flex-wrap justify-between">
                {DISABILITY_OPTIONS.map((option) => {
                  const selected = selectedDisability === option.type;
                  return (
                    <Pressable
                      key={option.type}
                      testID={`onboarding_disability_${option.type}`}
                      onPress={() => setSelectedDisability(option.type)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      className={`mb-3 h-24 w-[48%] items-center justify-center rounded-2xl border-2 ${
                        selected
                          ? 'border-primary bg-primary-50 dark:bg-primary-900'
                          : 'border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark'
                      }`}
                    >
                      <MaterialCommunityIcons
                        name={option.icon}
                        size={28}
                        color={selected ? '#6366F1' : option.color}
                      />
                      <Text
                        className={`mt-2 text-sm font-semibold ${
                          selected
                            ? 'text-primary-700 dark:text-primary-200'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Onboarding screen: 3 horizontal slides + a final PWD question.
 * Persists the user's choices to Firebase + the Zustand user store, then
 * routes into the tabs.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const updateUserStore = useUserStore((s) => s.setUser);

  const listRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPWD, setIsPWD] = useState<boolean | null>(null);
  const [selectedDisability, setSelectedDisability] = useState<DisabilityType | null>(null);
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create the user's real Firestore profile (keyed by the signed-in Firebase
   * uid) and mirror it into the store. Falls back to a local-only user if there
   * is no Firebase session (e.g. keys not configured).
   */
  const persistProfile = useCallback(
    async (disabilityType: DisabilityType, pwdMode: boolean): Promise<void> => {
      const preferences = {
        pwdMode,
        notifications: true,
        preferredCategories: [] as string[],
        preferredRadiusKm: 7,
      };
      const cleanFirst = sanitizeInput(firstName, 30);
      const cleanSurname = sanitizeInput(surname, 30);
      const fullName = `${cleanFirst} ${cleanSurname}`.trim();
      const firebaseUser = getCurrentUser();

      if (firebaseUser) {
        const profile = createDemoUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? 'guest@discova.app',
          ...(fullName.length > 0 ? { displayName: fullName } : {}),
          dob: isValidDob(dob) ? dob : '',
          gender: gender ?? '',
          disabilityType,
          pwdMode,
          preferences,
        });
        const { uid: _uid, joinedAt: _joinedAt, ...rest } = profile;
        void _uid;
        void _joinedAt;
        try {
          await createUserProfile(firebaseUser.uid, rest);
        } catch {
          /* offline / rules — still let the user in with the local profile */
        }
        updateUserStore(profile);
      } else {
        // No Firebase session — local-only profile so the app stays usable.
        updateUserStore(
          createDemoUser({
            ...(fullName.length > 0 ? { displayName: fullName } : {}),
            dob: isValidDob(dob) ? dob : '',
            gender: gender ?? '',
            disabilityType,
            pwdMode,
            preferences,
          }),
        );
      }
    },
    [updateUserStore, firstName, surname, dob, gender],
  );

  /** Update the dot indicator as the FlatList scrolls. */
  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (next !== activeIndex) setActiveIndex(next);
    },
    [activeIndex],
  );

  /** Advance to the next slide; on the last slide, run the save flow. */
  const handleNext = useCallback(async () => {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
      return;
    }
    // Final slide: validate details + selections, then persist.
    if (sanitizeInput(firstName, 30).length < 2) {
      setError('Please enter your first name.');
      return;
    }
    if (dob.length > 0 && !isValidDob(dob)) {
      setError('Date of birth looks invalid — use DD/MM/YYYY.');
      return;
    }
    if (!gender) {
      setError('Please select your gender.');
      return;
    }
    if (isPWD === null) {
      setError('Please answer the disability question to continue.');
      return;
    }
    if (isPWD && !selectedDisability) {
      setError('Please pick your primary accessibility need.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const disabilityType: DisabilityType = isPWD && selectedDisability ? selectedDisability : 'none';
      await persistProfile(disabilityType, isPWD);
      router.replace('/(tabs)');
    } catch {
      setError('Could not save your preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [activeIndex, isPWD, selectedDisability, firstName, dob, gender, persistProfile, router]);

  /** Skip onboarding — still create a real profile (disabilityType 'none'). */
  const handleSkip = useCallback(async () => {
    try {
      await persistProfile('none', false);
    } catch {
      /* best-effort */
    }
    router.replace('/(tabs)');
  }, [persistProfile, router]);

  const renderSlide = useCallback(
    ({ item }: ListRenderItemInfo<Slide>) => (
      <SlideView
        slide={item}
        isPWD={isPWD}
        setIsPWD={setIsPWD}
        selectedDisability={selectedDisability}
        setSelectedDisability={setSelectedDisability}
        firstName={firstName}
        setFirstName={setFirstName}
        surname={surname}
        setSurname={setSurname}
        dob={dob}
        setDob={setDob}
        gender={gender}
        setGender={setGender}
      />
    ),
    [isPWD, selectedDisability, firstName, surname, dob, gender],
  );

  const isLastSlide = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView
      testID="onboarding_screen"
      className="flex-1 bg-surface-light dark:bg-surface-dark"
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
      {/* Top bar: skip */}
      <View className="flex-row items-center justify-end px-4 py-2">
        <Pressable
          testID="onboarding_skip"
          onPress={handleSkip}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Skip
          </Text>
        </Pressable>
      </View>

      <Animated.View entering={FadeIn.duration(400)} className="flex-1">
        <FlatList
          ref={listRef}
          testID="onboarding_slides"
          data={SLIDES}
          keyExtractor={(item) => item.key}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />
      </Animated.View>

      <DotIndicator count={SLIDES.length} activeIndex={activeIndex} />

      {/* Footer: error + primary CTA */}
      <View className="px-6 pb-6">
        {error ? (
          <View
            testID="onboarding_error"
            accessibilityLiveRegion="polite"
            className="mb-3 rounded-xl bg-danger/15 px-4 py-3"
          >
            <Text className="text-sm font-medium text-danger">{error}</Text>
          </View>
        ) : null}

        <Pressable
          testID="onboarding_next"
          onPress={handleNext}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={isLastSlide ? 'Finish onboarding' : 'Next slide'}
          className={`h-14 flex-row items-center justify-center rounded-2xl bg-primary ${
            saving ? 'opacity-70' : ''
          }`}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text className="text-base font-semibold text-white">
                {isLastSlide ? 'Get started' : 'Next'}
              </Text>
              <Ionicons
                name={isLastSlide ? 'checkmark' : 'arrow-forward'}
                size={20}
                color="#FFFFFF"
                style={{ marginLeft: 8 }}
              />
            </>
          )}
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
