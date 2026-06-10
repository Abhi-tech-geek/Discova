import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { WordmarkMark } from '../../components/design/Wordmark';
import { AURORA, COLORS } from '../../components/design/theme';
import { emailLoginOrSignUp, signInAnonymouslyUser } from '../../services/firebase';

/** Map a thrown auth error to a short, user-friendly sentence. */
function describeError(error: unknown): string {
  const code = (error as { code?: string }).code ?? '';
  if (code === 'auth/invalid-email') return 'That email looks invalid.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'auth/wrong-password') return 'Wrong password for this email.';
  if (code === 'auth/email-already-in-use') return 'Email already in use — try logging in.';
  if (code === 'auth/operation-not-allowed') {
    return 'Email sign-in is off. Enable Email/Password in Firebase console.';
  }
  if (/network/i.test(code)) return 'Check your internet and try again.';
  return 'Something went wrong. Please try again.';
}

/** One value-prop row in the hero. */
function ValueRow({
  icon,
  text,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.18)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons name={icon} size={16} color="#FFFFFF" />
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13.5, fontWeight: '600', flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

/** Glassy text-input row. */
function Field({
  icon,
  children,
  trailing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 54,
        borderRadius: 15,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
      }}
    >
      <Ionicons name={icon} size={18} color="rgba(255,255,255,0.7)" />
      {children}
      {trailing}
    </View>
  );
}

/**
 * DISCOVA login — aurora hero, value props, and email/password sign-in
 * (auto sign-up for new emails). "Continue as guest" signs in anonymously.
 */
export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Email + password: log in if the account exists, else create it. */
  const handleContinue = useCallback(async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await emailLoginOrSignUp(email, password);
      router.push('/auth/onboarding');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [email, password, router]);

  /** Anonymous guest sign-in. */
  const handleGuest = useCallback(async () => {
    setError(null);
    setGuestLoading(true);
    try {
      await signInAnonymouslyUser();
      router.push('/auth/onboarding');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setGuestLoading(false);
    }
  }, [router]);

  const busy = loading || guestLoading;

  return (
    <View testID="login_screen" style={{ flex: 1, backgroundColor: '#0B0C10' }}>
      {/* Soft aurora glows on a dark base */}
      <LinearGradient
        colors={['rgba(122,61,245,0.55)', 'rgba(46,107,255,0.25)', 'transparent']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 0.7 }}
        style={{ position: 'absolute', top: -120, left: -80, width: 420, height: 420, borderRadius: 420 }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(19,194,232,0.18)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', bottom: -60, right: -80, width: 360, height: 360, borderRadius: 360 }}
      />

      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>
        {/* Brand + hero */}
        <View style={{ paddingHorizontal: 26, paddingTop: 12 }}>
          <Animated.View entering={FadeIn.duration(600)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <WordmarkMark size={34} />
              <Text style={{ fontSize: 21, color: '#FFFFFF', fontWeight: '800', letterSpacing: -0.5 }}>
                Discova
              </Text>
            </View>

            <Text
              style={{
                marginTop: 26,
                fontSize: 33,
                lineHeight: 37,
                fontWeight: '800',
                letterSpacing: -1.3,
                color: '#FFFFFF',
              }}
            >
              Places everyone{'\n'}can{' '}
              <Text style={{ color: COLORS.brand }}>actually enjoy.</Text>
            </Text>

            <View style={{ marginTop: 18 }}>
              <ValueRow icon="star-four-points" text="AI accessibility scores from real photos + reviews" />
              <ValueRow icon="account-group" text="See how busy or quiet a place is right now" />
              <ValueRow icon="wheelchair-accessibility" text="Wheelchair, stroller & senior friendly" />
            </View>
          </Animated.View>
        </View>

        {/* Form */}
        <View style={{ paddingHorizontal: 26, paddingBottom: 26 }}>
          <Animated.View entering={FadeInDown.duration(650).delay(120)}>
            {error ? (
              <View
                testID="login_error"
                accessibilityLiveRegion="polite"
                style={{ marginBottom: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(229,72,77,0.22)' }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{error}</Text>
              </View>
            ) : null}

            {/* Sign in / Sign up toggle */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: 'rgba(255,255,255,0.10)',
                borderRadius: 14,
                padding: 4,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.18)',
              }}
            >
              {(['signin', 'signup'] as const).map((m) => {
                const sel = mode === m;
                return (
                  <Pressable
                    key={m}
                    testID={`login_mode_${m}`}
                    onPress={() => {
                      setMode(m);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      borderRadius: 11,
                      alignItems: 'center',
                      backgroundColor: sel ? 'rgba(255,255,255,0.18)' : 'transparent',
                    }}
                  >
                    <Text style={{ color: sel ? '#FFFFFF' : 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 13.5 }}>
                      {m === 'signin' ? 'Sign in' : 'Sign up'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ gap: 10 }}>
              <Field icon="mail-outline">
                <TextInput
                  testID="login_email_input"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Email address"
                  style={{ flex: 1, marginLeft: 10, color: '#FFFFFF', fontSize: 15 }}
                />
              </Field>

              <Field
                icon="lock-closed-outline"
                trailing={
                  <Pressable
                    testID="login_password_toggle"
                    onPress={() => setShowPw((v) => !v)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={showPw ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPw ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="rgba(255,255,255,0.7)"
                    />
                  </Pressable>
                }
              >
                <TextInput
                  testID="login_password_input"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password (min 6 chars)"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  accessibilityLabel="Password"
                  onSubmitEditing={handleContinue}
                  style={{ flex: 1, marginLeft: 10, color: '#FFFFFF', fontSize: 15 }}
                />
              </Field>
            </View>

            <Pressable
              testID="login_continue_button"
              onPress={handleContinue}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Continue with email"
              style={{ marginTop: 14 }}
            >
              <LinearGradient
                colors={[...AURORA]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  height: 54,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  shadowColor: COLORS.brand,
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.4,
                  shadowRadius: 20,
                  elevation: 8,
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                      {mode === 'signin' ? 'Sign in' : 'Create account'}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              testID="login_guest_button"
              onPress={handleGuest}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Continue as guest"
              style={{
                marginTop: 12,
                height: 50,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
              }}
            >
              {guestLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' }}>
                    Continue as guest
                  </Text>
                </>
              )}
            </Pressable>

            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5, textAlign: 'center', marginTop: 14 }}>
              New email? An account is created automatically.
            </Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
