import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BadgeCard } from '../../components/BadgeCard';
import { AURORA } from '../../components/design/theme';
import { orchestrator } from '../../services/agents/orchestrator';
import { useUserStore } from '../../stores/userStore';
import { sanitizeInput } from '../../utils/sanitize';
import type {
  Badge,
  ManualAccessibilityChecklist,
  PostCreationResult,
} from '../../types';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

type Step = 1 | 2 | 3;
type ShareTo = 'feed' | 'story';

const STATUS_MESSAGES = [
  'Analyzing your photo…',
  'Detecting accessibility features…',
  'Generating caption…',
  'Scoring accessibility…',
  'Awarding coins…',
];

const HASHTAG_SUGGESTIONS = [
  '#accessible',
  '#wheelchairfriendly',
  '#discova',
  '#delhi',
  '#travelforall',
] as const;

interface AccessibilityToggleDef {
  key: keyof Pick<
    ManualAccessibilityChecklist,
    'hasRamp' | 'hasElevator' | 'hasAccessibleRestroom' | 'hasWideEntries'
  >;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const ACCESSIBILITY_TOGGLES: AccessibilityToggleDef[] = [
  { key: 'hasRamp', label: 'Ramp / step-free entry', icon: 'wheelchair' },
  { key: 'hasElevator', label: 'Elevator / lift', icon: 'elevator-passenger' },
  { key: 'hasAccessibleRestroom', label: 'Accessible restroom', icon: 'human-male-female' },
  { key: 'hasWideEntries', label: 'Wide entrance', icon: 'door-open' },
];

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

/** 3-pill step indicator across the top of the screen. */
function StepIndicator({ step }: { step: Step }) {
  return (
    <View
      testID="camera_step_indicator"
      className="flex-row items-center justify-center py-3"
    >
      {[1, 2, 3].map((n) => (
        <Fragment key={n}>
          <View
            testID={`camera_step_pill_${n}`}
            className={`h-7 w-7 items-center justify-center rounded-full ${
              n <= step ? 'bg-primary' : 'bg-muted-light dark:bg-muted-dark'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                n <= step ? 'text-white' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {n}
            </Text>
          </View>
          {n < 3 ? (
            <View
              className={`mx-1 h-0.5 w-8 ${
                n < step ? 'bg-primary' : 'bg-muted-light dark:bg-muted-dark'
              }`}
            />
          ) : null}
        </Fragment>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  STEP 1 — Capture                                                          */
/* -------------------------------------------------------------------------- */

/** Inline permission UI for users who haven't yet granted the camera. */
function CameraPermissionGate({
  onRequest,
  denied,
}: {
  onRequest: () => void;
  denied: boolean;
}) {
  return (
    <View
      testID="camera_permission_gate"
      className="flex-1 items-center justify-center bg-surface-light px-6 dark:bg-surface-dark"
    >
      <Ionicons name="camera-outline" size={56} color="#6366F1" />
      <Text className="mt-4 text-center text-base font-semibold text-gray-900 dark:text-white">
        Camera access needed
      </Text>
      <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
        Discova needs camera access to capture and score accessibility photos.
      </Text>
      <Pressable
        testID="camera_permission_request"
        onPress={onRequest}
        accessibilityRole="button"
        className="mt-6 h-12 flex-row items-center justify-center rounded-2xl bg-primary px-6"
      >
        <Text className="text-base font-semibold text-white">
          {denied ? 'Try again' : 'Grant permission'}
        </Text>
      </Pressable>
    </View>
  );
}

/** STEP 1 — full-screen camera with capture / gallery / flip controls. */
function Step1Capture({
  onCaptured,
}: {
  onCaptured: (uri: string) => void;
}) {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);

  // Request camera permission on mount if not already known.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  /** Take a still photo and forward the local file uri to the parent. */
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });
      if (photo?.uri) onCaptured(photo.uri);
    } catch {
      /* user moved off too fast; no-op */
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCaptured]);

  /** Open the gallery and forward the selected uri. */
  const handleGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsMultipleSelection: false,
      });
      if (!result.canceled && result.assets[0]) {
        onCaptured(result.assets[0].uri);
      }
    } catch {
      /* picker cancelled or unavailable */
    }
  }, [onCaptured]);

  /** Flip between back and front cameras. */
  const handleFlip = useCallback(() => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, []);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-light dark:bg-surface-dark">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <CameraPermissionGate
        onRequest={() => {
          void requestPermission();
        }}
        denied={!permission.canAskAgain}
      />
    );
  }

  return (
    <View testID="camera_step1_view" className="flex-1 bg-black">
      <CameraView
        ref={cameraRef}
        facing={facing}
        style={{ flex: 1 }}
      />

      {/* Overlay controls */}
      <View className="absolute inset-x-0 bottom-0 px-8 pb-10">
        <View className="flex-row items-center justify-between">
          {/* Gallery */}
          <Pressable
            testID="camera_gallery_button"
            onPress={handleGallery}
            accessibilityRole="button"
            accessibilityLabel="Pick from gallery"
            className="h-14 w-14 items-center justify-center rounded-2xl bg-white/15"
          >
            <Ionicons name="images-outline" size={26} color="#FFFFFF" />
          </Pressable>

          {/* Capture */}
          <Pressable
            testID="camera_capture_button"
            onPress={handleCapture}
            disabled={capturing}
            accessibilityRole="button"
            accessibilityLabel="Capture photo"
            className={`h-20 w-20 items-center justify-center rounded-full border-4 border-white ${
              capturing ? 'bg-primary' : 'bg-white'
            }`}
          >
            {capturing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View className="h-16 w-16 rounded-full bg-white" />
            )}
          </Pressable>

          {/* Flip */}
          <Pressable
            testID="camera_flip_button"
            onPress={handleFlip}
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
            className="h-14 w-14 items-center justify-center rounded-2xl bg-white/15"
          >
            <Ionicons name="camera-reverse-outline" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  STEP 2 — Edit / preview                                                   */
/* -------------------------------------------------------------------------- */

interface DetectedLocation {
  name: string;
  latitude: number;
  longitude: number;
}

/** STEP 2 — preview + caption + accessibility checklist + share. */
function Step2Edit({
  imageUri,
  onShare,
  onBack,
}: {
  imageUri: string;
  onShare: (state: {
    caption: string;
    checklist: ManualAccessibilityChecklist;
    shareTo: ShareTo;
    location: DetectedLocation | null;
  }) => void;
  onBack: () => void;
}) {
  const [caption, setCaption] = useState('');
  const [checklist, setChecklist] = useState<ManualAccessibilityChecklist>({});
  const [shareTo, setShareTo] = useState<ShareTo>('feed');
  const [location, setLocation] = useState<DetectedLocation | null>(null);
  const [locating, setLocating] = useState(true);

  // Auto-detect location on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setLocating(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        const reverse = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (cancelled) return;
        const top = reverse[0];
        const name =
          top?.name ||
          top?.district ||
          top?.city ||
          top?.region ||
          'Current location';
        setLocation({
          name,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {
        /* ignore — location optional */
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Append a hashtag to the caption (avoiding duplicates). */
  const handleHashtag = useCallback((tag: string) => {
    setCaption((prev) => {
      if (prev.includes(tag)) return prev;
      const sep = prev.length === 0 || prev.endsWith(' ') ? '' : ' ';
      return `${prev}${sep}${tag}`;
    });
  }, []);

  /** Toggle one accessibility flag. */
  const setFlag = useCallback(
    (key: AccessibilityToggleDef['key'], value: boolean) => {
      setChecklist((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const canShare = imageUri.length > 0;

  return (
    <View testID="camera_step2_view" className="flex-1 bg-surface-light dark:bg-surface-dark">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Preview — top ~40% via aspect-square */}
        <View className="relative bg-black">
          <Image
            testID="camera_step2_preview"
            source={{ uri: imageUri }}
            className="aspect-square w-full"
            resizeMode="cover"
          />
          <Pressable
            testID="camera_step2_back"
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to camera"
            hitSlop={8}
            className="absolute left-4 top-4 h-10 w-10 items-center justify-center rounded-full bg-black/40"
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View className="p-4">
          {/* Caption */}
          <Text className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Caption
          </Text>
          <TextInput
            testID="camera_caption_input"
            value={caption}
            onChangeText={setCaption}
            placeholder="Tell people about this place…"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
            className="min-h-[80px] rounded-2xl border border-border-light bg-surface-light p-3 text-sm text-gray-900 dark:border-border-dark dark:bg-muted-dark dark:text-white"
          />

          {/* Location */}
          <View
            testID="camera_location_block"
            className="mt-4 flex-row items-center rounded-2xl border border-border-light bg-muted-light px-3 py-2.5 dark:border-border-dark dark:bg-muted-dark"
          >
            <Ionicons
              name="location"
              size={16}
              color={location ? '#6366F1' : '#9CA3AF'}
            />
            <Text
              numberOfLines={1}
              className="ml-2 flex-1 text-sm text-gray-800 dark:text-gray-100"
            >
              {locating
                ? 'Detecting location…'
                : location?.name ?? 'Location unavailable'}
            </Text>
            {locating ? <ActivityIndicator size="small" color="#6366F1" /> : null}
          </View>

          {/* Accessibility toggles */}
          <Text className="mb-2 mt-5 text-sm font-semibold text-gray-700 dark:text-gray-200">
            What did you see here?
          </Text>
          <View className="rounded-2xl border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark">
            {ACCESSIBILITY_TOGGLES.map((t, i) => (
              <View
                key={t.key}
                testID={`camera_toggle_${t.key}`}
                className={`flex-row items-center justify-between px-3 py-3 ${
                  i < ACCESSIBILITY_TOGGLES.length - 1
                    ? 'border-b border-border-light dark:border-border-dark'
                    : ''
                }`}
              >
                <View className="flex-1 flex-row items-center">
                  <MaterialCommunityIcons
                    name={t.icon}
                    size={20}
                    color="#6366F1"
                  />
                  <Text className="ml-3 flex-1 text-sm text-gray-900 dark:text-white">
                    {t.label}
                  </Text>
                </View>
                <Switch
                  testID={`camera_toggle_switch_${t.key}`}
                  value={checklist[t.key] === true}
                  onValueChange={(v) => setFlag(t.key, v)}
                  trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </View>

          {/* Share-to selector */}
          <Text className="mb-2 mt-5 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Share to
          </Text>
          <View className="flex-row">
            <Pressable
              testID="camera_share_feed"
              onPress={() => setShareTo('feed')}
              accessibilityRole="radio"
              accessibilityState={{ selected: shareTo === 'feed' }}
              className={`mr-2 h-12 flex-1 flex-row items-center justify-center rounded-xl border-2 ${
                shareTo === 'feed'
                  ? 'border-primary bg-primary'
                  : 'border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark'
              }`}
            >
              <Ionicons
                name="grid-outline"
                size={16}
                color={shareTo === 'feed' ? '#FFFFFF' : '#6B7280'}
              />
              <Text
                className={`ml-2 text-sm font-semibold ${
                  shareTo === 'feed'
                    ? 'text-white'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                Feed
              </Text>
            </Pressable>
            <Pressable
              testID="camera_share_story"
              onPress={() => setShareTo('story')}
              accessibilityRole="radio"
              accessibilityState={{ selected: shareTo === 'story' }}
              className={`ml-2 h-12 flex-1 flex-row items-center justify-center rounded-xl border-2 ${
                shareTo === 'story'
                  ? 'border-primary bg-primary'
                  : 'border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark'
              }`}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={shareTo === 'story' ? '#FFFFFF' : '#6B7280'}
              />
              <Text
                className={`ml-2 text-sm font-semibold ${
                  shareTo === 'story'
                    ? 'text-white'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                Story (24h)
              </Text>
            </Pressable>
          </View>

          {/* Hashtag suggestions */}
          <Text className="mb-2 mt-5 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Suggested hashtags
          </Text>
          <View className="flex-row flex-wrap">
            {HASHTAG_SUGGESTIONS.map((tag) => {
              const active = caption.includes(tag);
              return (
                <Pressable
                  key={tag}
                  testID={`camera_hashtag_${tag.slice(1)}`}
                  onPress={() => handleHashtag(tag)}
                  accessibilityRole="button"
                  className={`mb-2 mr-2 rounded-full border px-3 py-1.5 ${
                    active
                      ? 'border-primary bg-primary-50 dark:bg-primary-900'
                      : 'border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      active
                        ? 'text-primary-700 dark:text-primary-200'
                        : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Share */}
          <Pressable
            testID="camera_share_button"
            onPress={() =>
              onShare({
                caption: sanitizeInput(caption, 500),
                checklist,
                shareTo,
                location,
              })
            }
            disabled={!canShare}
            accessibilityRole="button"
            accessibilityLabel="Share post"
            style={{ marginTop: 24 }}
          >
            <LinearGradient
              colors={[...AURORA]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                height: 56,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#2E6BFF',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
                elevation: 6,
                opacity: canShare ? 1 : 0.6,
              }}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text className="ml-2 text-base font-semibold text-white">Share post</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  STEP 3 — AI processing + success                                          */
/* -------------------------------------------------------------------------- */

/** Spinning wheelchair icon driven by a Reanimated rotation loop. */
function SpinnerWheelchair() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1500, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      testID="camera_processing_spinner"
      style={style}
      className="h-20 w-20 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900"
    >
      <MaterialCommunityIcons name="wheelchair-accessibility" size={44} color="#6366F1" />
    </Animated.View>
  );
}

/** Success-state checkmark with a one-shot scale spring. */
function CheckmarkBurst() {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.15, { damping: 8, stiffness: 200 }),
      withTiming(1, { duration: 180 }),
    );
  }, [scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      testID="camera_success_check"
      style={style}
      className="h-24 w-24 items-center justify-center rounded-full bg-success"
    >
      <Ionicons name="checkmark" size={56} color="#FFFFFF" />
    </Animated.View>
  );
}

/** Processing screen — runs the orchestrator and reveals the success state. */
function Step3Processing({
  imageUri,
  caption,
  checklist,
  location,
  onDone,
}: {
  imageUri: string;
  caption: string;
  checklist: ManualAccessibilityChecklist;
  location: DetectedLocation | null;
  onDone: () => void;
}) {
  const user = useUserStore((s) => s.user);
  const updateCoins = useUserStore((s) => s.updateCoins);

  type PhaseState =
    | { phase: 'running'; statusIndex: number }
    | { phase: 'done'; result: PostCreationResult }
    | { phase: 'error'; message: string };

  const [state, setState] = useState<PhaseState>({ phase: 'running', statusIndex: 0 });

  // Cycle the status messages while running.
  useEffect(() => {
    if (state.phase !== 'running') return;
    const interval = setInterval(() => {
      setState((prev) =>
        prev.phase === 'running'
          ? { phase: 'running', statusIndex: (prev.statusIndex + 1) % STATUS_MESSAGES.length }
          : prev,
      );
    }, 1500);
    return () => clearInterval(interval);
  }, [state.phase]);

  // Kick off the orchestrator once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setState({ phase: 'error', message: 'You need to sign in before posting.' });
        return;
      }
      try {
        // Resize + JPEG-compress + base64 for the vision API.
        const manipulated = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 1024 } }],
          {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );

        const placeId =
          location !== null
            ? `place_${location.latitude.toFixed(4)}_${location.longitude.toFixed(4)}`
            : `place_temp_${Date.now()}`;
        const placeName = location?.name ?? 'Unknown place';

        const result = await orchestrator.handlePostCreation({
          user,
          placeId,
          placeName,
          placeType: 'general',
          imageUri: manipulated.uri,
          imageBase64: manipulated.base64 ?? '',
          manualCaption: caption,
          manualChecklist: checklist,
        });

        if (cancelled) return;
        // Mirror the coins into the Zustand store so the UI updates immediately.
        if (result.coinsAwarded > 0) updateCoins(result.coinsAwarded);
        setState({ phase: 'done', result });
      } catch {
        if (cancelled) return;
        setState({ phase: 'error', message: 'Could not post right now. Please try again.' });
      }
    })();
    return () => {
      cancelled = true;
    };
    // We intentionally run this once when the screen mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.phase === 'running') {
    const status = STATUS_MESSAGES[state.statusIndex] ?? STATUS_MESSAGES[0];
    return (
      <View
        testID="camera_step3_running"
        className="flex-1 items-center justify-center bg-surface-light px-6 dark:bg-surface-dark"
      >
        <SpinnerWheelchair />
        <Animated.Text
          key={status}
          entering={FadeIn.duration(300)}
          className="mt-6 text-center text-base font-medium text-gray-700 dark:text-gray-200"
        >
          {status}
        </Animated.Text>
        <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          This usually takes a few seconds.
        </Text>
      </View>
    );
  }

  if (state.phase === 'error') {
    return (
      <View
        testID="camera_step3_error"
        className="flex-1 items-center justify-center bg-surface-light px-6 dark:bg-surface-dark"
      >
        <Ionicons name="alert-circle" size={56} color="#EF4444" />
        <Text className="mt-4 text-center text-base font-semibold text-gray-900 dark:text-white">
          {state.message}
        </Text>
        <Pressable
          testID="camera_step3_error_back"
          onPress={onDone}
          accessibilityRole="button"
          className="mt-6 h-12 flex-row items-center justify-center rounded-2xl bg-primary px-6"
        >
          <Text className="text-base font-semibold text-white">Back to home</Text>
        </Pressable>
      </View>
    );
  }

  return <SuccessView result={state.result} onDone={onDone} />;
}

/** Render the success state once the orchestrator returns. */
function SuccessView({
  result,
  onDone,
}: {
  result: PostCreationResult;
  onDone: () => void;
}) {
  const features = useMemo(
    () => (result.analysis.detectedFeatures ?? []).slice(0, 8),
    [result.analysis.detectedFeatures],
  );

  return (
    <ScrollView
      testID="camera_step3_success"
      contentContainerStyle={{ flexGrow: 1, padding: 24, alignItems: 'center' }}
      className="bg-surface-light dark:bg-surface-dark"
    >
      <View className="mt-6 items-center">
        <CheckmarkBurst />
        <Text className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
          Post shared!
        </Text>
        <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
          Thanks for making the map a little more accessible.
        </Text>
      </View>

      {/* Coins */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(200)}
        className="mt-6 flex-row items-center rounded-2xl bg-accent/15 px-4 py-3"
      >
        <MaterialCommunityIcons name="star-four-points" size={22} color="#F59E0B" />
        <Text className="ml-2 text-base font-semibold text-accent">
          +{result.coinsAwarded} coins earned
        </Text>
      </Animated.View>

      {/* Detected features chips with staggered fade-in */}
      {features.length > 0 ? (
        <View testID="camera_success_features" className="mt-6 w-full">
          <Text className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            We spotted
          </Text>
          <View className="flex-row flex-wrap">
            {features.map((feature, i) => (
              <Animated.View
                key={`${feature}-${i}`}
                entering={FadeInDown.duration(350).delay(300 + i * 100)}
                testID={`camera_success_feature_chip_${i}`}
                className="mb-2 mr-2 flex-row items-center rounded-full bg-success/15 px-2.5 py-1"
              >
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text className="ml-1 text-xs font-medium text-success">
                  {feature}
                </Text>
              </Animated.View>
            ))}
          </View>
        </View>
      ) : null}

      {/* New badges */}
      {result.newBadges.length > 0 ? (
        <View testID="camera_success_badges" className="mt-6 w-full">
          <Text className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            New badge unlocked!
          </Text>
          {result.newBadges.map((badge: Badge) => (
            <Animated.View
              key={badge.id}
              entering={FadeInDown.duration(400).delay(500)}
            >
              <BadgeCard badge={badge} isEarned />
            </Animated.View>
          ))}
        </View>
      ) : null}

      {/* Done */}
      <Pressable
        testID="camera_success_done"
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        className="mt-8 h-14 w-full flex-row items-center justify-center rounded-2xl bg-primary"
      >
        <Text className="text-base font-semibold text-white">Back to home</Text>
      </Pressable>

      {/* Tiny hint so the user knows the caption was generated. */}
      {result.caption.caption.length > 0 ? (
        <Text className="mt-4 text-center text-xs italic text-gray-400 dark:text-gray-500">
          AI caption: &ldquo;{result.caption.caption}&rdquo;
        </Text>
      ) : null}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

interface PostDraft {
  imageUri: string;
  caption: string;
  checklist: ManualAccessibilityChecklist;
  shareTo: ShareTo;
  location: DetectedLocation | null;
}

/**
 * Camera tab — 3-step post-creation flow.
 *   1. Capture or pick a photo.
 *   2. Add caption + accessibility checklist + location.
 *   3. Run the agent orchestrator and show the success state.
 */
export default function CameraScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<PostDraft | null>(null);

  /** Move to step 2 with the captured uri. */
  const handleCaptured = useCallback((uri: string) => {
    setDraft({
      imageUri: uri,
      caption: '',
      checklist: {},
      shareTo: 'feed',
      location: null,
    });
    setStep(2);
  }, []);

  /** Move to step 3 with the finalized draft. */
  const handleShare = useCallback(
    (payload: {
      caption: string;
      checklist: ManualAccessibilityChecklist;
      shareTo: ShareTo;
      location: DetectedLocation | null;
    }) => {
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              caption: payload.caption,
              checklist: payload.checklist,
              shareTo: payload.shareTo,
              location: payload.location,
            }
          : prev,
      );
      setStep(3);
    },
    [],
  );

  /** Back to camera from step 2. */
  const handleBackToCapture = useCallback(() => {
    setDraft(null);
    setStep(1);
  }, []);

  /** Done from step 3 — reset the flow and route home. */
  const handleDone = useCallback(() => {
    setDraft(null);
    setStep(1);
    router.replace('/(tabs)');
  }, [router]);

  return (
    <SafeAreaView
      edges={step === 1 ? [] : ['top']}
      className={`flex-1 ${step === 1 ? 'bg-black' : 'bg-surface-light dark:bg-surface-dark'}`}
    >
      {step !== 1 ? <StepIndicator step={step} /> : null}
      {step === 1 ? <Step1Capture onCaptured={handleCaptured} /> : null}
      {step === 2 && draft !== null ? (
        <Step2Edit
          imageUri={draft.imageUri}
          onShare={handleShare}
          onBack={handleBackToCapture}
        />
      ) : null}
      {step === 3 && draft !== null ? (
        <Step3Processing
          imageUri={draft.imageUri}
          caption={draft.caption}
          checklist={draft.checklist}
          location={draft.location}
          onDone={handleDone}
        />
      ) : null}
      {/* iOS keyboard breathing room */}
      {Platform.OS === 'ios' ? <View className="h-0" /> : null}
    </SafeAreaView>
  );
}
