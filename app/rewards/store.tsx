import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AURORA } from '../../components/design/theme';
import { redeemReward as fbRedeemReward } from '../../services/firebase';
import { useUserStore } from '../../stores/userStore';

/* -------------------------------------------------------------------------- */
/*  Categories + rewards                                                      */
/* -------------------------------------------------------------------------- */

type CategoryKey = 'all' | 'travel' | 'shopping' | 'food' | 'wellness' | 'experiences';

interface CategoryDef {
  key: CategoryKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'all', label: 'All', icon: 'sparkles-outline' },
  { key: 'travel', label: 'Travel', icon: 'airplane-outline' },
  { key: 'shopping', label: 'Shopping', icon: 'bag-handle-outline' },
  { key: 'food', label: 'Food', icon: 'cafe-outline' },
  { key: 'wellness', label: 'Wellness', icon: 'fitness-outline' },
  { key: 'experiences', label: 'Experiences', icon: 'compass-outline' },
];

interface StoreReward {
  id: string;
  partner: string;
  title: string;
  discount: string;
  description: string;
  cost: number;
  category: Exclude<CategoryKey, 'all'>;
  icon: string;
  accent: readonly [string, string];
}

const REWARDS: StoreReward[] = [
  {
    id: 'ccd',
    partner: 'Cafe Coffee Day',
    title: 'Coffee on us',
    discount: '20% OFF',
    description: 'Valid at all CCD outlets in Delhi NCR.',
    cost: 100,
    category: 'food',
    icon: '☕',
    accent: ['#7C2D12', '#B45309'],
  },
  {
    id: 'uber',
    partner: 'Uber Access',
    title: 'Wheelchair-accessible ride',
    discount: '₹150 OFF',
    description: 'One-time discount on UberAssist rides.',
    cost: 200,
    category: 'travel',
    icon: '🚗',
    accent: ['#111827', '#374151'],
  },
  {
    id: 'olaair',
    partner: 'Indigo Airlines',
    title: 'Priority assistance',
    discount: '10% OFF',
    description: 'Domestic flights for assisted travellers.',
    cost: 500,
    category: 'travel',
    icon: '✈️',
    accent: ['#1E3A8A', '#3B82F6'],
  },
  {
    id: 'amazon',
    partner: 'Amazon',
    title: 'Mobility shop credit',
    discount: '₹250 OFF',
    description: 'Spend on mobility & assistive devices.',
    cost: 300,
    category: 'shopping',
    icon: '🛍️',
    accent: ['#0F766E', '#14B8A6'],
  },
  {
    id: 'cult',
    partner: 'Cult.fit',
    title: 'Inclusive class pack',
    discount: '15% OFF',
    description: '4 inclusive sessions at any Cult center.',
    cost: 250,
    category: 'wellness',
    icon: '🧘',
    accent: ['#7E22CE', '#A855F7'],
  },
  {
    id: 'bookmyshow',
    partner: 'BookMyShow',
    title: 'Movie for two',
    discount: '₹200 OFF',
    description: 'Accessible-seating bookings only.',
    cost: 180,
    category: 'experiences',
    icon: '🎬',
    accent: ['#9F1239', '#EC4899'],
  },
  {
    id: 'zomato',
    partner: 'Zomato',
    title: 'Order in',
    discount: '₹100 OFF',
    description: 'First order from accessible-rated restaurants.',
    cost: 80,
    category: 'food',
    icon: '🍽️',
    accent: ['#B91C1C', '#EF4444'],
  },
  {
    id: 'redbus',
    partner: 'RedBus',
    title: 'Accessible bus seat',
    discount: '₹120 OFF',
    description: 'Sleeper or low-floor buses.',
    cost: 150,
    category: 'travel',
    icon: '🚌',
    accent: ['#854D0E', '#FCD34D'],
  },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Build a short A-Z + digits code (no I/O/0/1) for a redemption. */
function generateDiscountCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'DSCV-';
  for (let i = 0; i < 8; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

/** Stylized QR placeholder — keeps the demo dep-free. */
function QRPlaceholder() {
  return (
    <View
      testID="rewards_qr_placeholder"
      className="h-48 w-48 items-center justify-center rounded-2xl bg-white p-3"
    >
      <View className="h-full w-full items-center justify-center rounded-xl bg-gray-900">
        <MaterialCommunityIcons name="qrcode" size={140} color="#FFFFFF" />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

interface RedeemState {
  reward: StoreReward;
  phase: 'confirm' | 'submitting' | 'success';
  code: string;
}

/** One reward grid card. */
function RewardCard({
  reward,
  onRedeem,
  affordable,
}: {
  reward: StoreReward;
  onRedeem: (reward: StoreReward) => void;
  affordable: boolean;
}) {
  return (
    <View
      testID={`reward_card_${reward.id}`}
      className="m-1 flex-1 overflow-hidden rounded-2xl border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark"
    >
      <LinearGradient
        colors={[reward.accent[0], reward.accent[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="h-20 items-center justify-center"
      >
        <Text className="text-4xl">{reward.icon}</Text>
      </LinearGradient>

      <View className="p-3">
        <Text
          numberOfLines={1}
          className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
        >
          {reward.partner}
        </Text>
        <Text
          numberOfLines={2}
          className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white"
        >
          {reward.title}
        </Text>
        <View className="mt-1 self-start rounded-full bg-success/15 px-2 py-0.5">
          <Text className="text-[10px] font-bold text-success">
            {reward.discount}
          </Text>
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <MaterialCommunityIcons
              name="star-four-points"
              size={12}
              color="#F59E0B"
            />
            <Text className="ml-1 text-xs font-semibold text-gray-900 dark:text-white">
              {reward.cost.toLocaleString()}
            </Text>
          </View>
          <Pressable
            testID={`rewards_redeem_button_${reward.id}`}
            onPress={() => onRedeem(reward)}
            accessibilityRole="button"
            accessibilityLabel={`Redeem ${reward.title}`}
            className={`rounded-full px-3 py-1.5 ${
              affordable ? 'bg-primary' : 'bg-muted-light dark:bg-muted-dark'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                affordable
                  ? 'text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {affordable ? 'Redeem' : 'Locked'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Challenges + Leaderboard (seed)                                           */
/* -------------------------------------------------------------------------- */

interface Challenge {
  id: string;
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  progress: number;
  total: number;
  reward: number;
}

const CHALLENGES: Challenge[] = [
  { id: 'c1', title: 'Map 5 step-free cafés', icon: 'coffee', progress: 3, total: 5, reward: 200 },
  { id: 'c2', title: 'Verify 3 accessible washrooms', icon: 'human-male-female', progress: 1, total: 3, reward: 150 },
  { id: 'c3', title: 'Add 10 ramp photos this week', icon: 'stairs-up', progress: 4, total: 10, reward: 300 },
];

interface LeaderRow {
  name: string;
  points: number;
  you?: boolean;
}

const LEADERBOARD: LeaderRow[] = [
  { name: 'Meera Nair', points: 3120 },
  { name: 'You', points: 2480, you: true },
  { name: 'Rohan Mehta', points: 2210 },
  { name: 'Kabir Singh', points: 1870 },
  { name: 'Diya Kapoor', points: 1640 },
];

/** Challenges + leaderboard block, rendered above the rewards grid. */
function RewardsHeader() {
  return (
    <View style={{ paddingHorizontal: 8, paddingTop: 8 }}>
      {/* Challenges */}
      <Text className="mb-2 mt-1 px-1 text-base font-bold text-gray-900 dark:text-white">
        Weekly challenges
      </Text>
      {CHALLENGES.map((c) => {
        const pct = Math.min(100, (c.progress / c.total) * 100);
        return (
          <View
            key={c.id}
            testID={`rewards_challenge_${c.id}`}
            className="mb-2 flex-row items-center rounded-2xl border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark"
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900">
              <MaterialCommunityIcons name={c.icon} size={20} color="#2E6BFF" />
            </View>
            <View className="ml-3 flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                  {c.title}
                </Text>
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="star-four-points" size={12} color="#F6A82B" />
                  <Text className="ml-0.5 text-xs font-bold text-accent-dark">+{c.reward}</Text>
                </View>
              </View>
              <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted-light dark:bg-muted-dark">
                <View style={{ width: `${pct}%` }} className="h-1.5 rounded-full bg-brand-2" />
              </View>
              <Text className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                {c.progress} / {c.total} done
              </Text>
            </View>
          </View>
        );
      })}

      {/* Leaderboard */}
      <Text className="mb-2 mt-3 px-1 text-base font-bold text-gray-900 dark:text-white">
        Leaderboard
      </Text>
      <View className="mb-3 rounded-2xl border border-border-light bg-surface-light px-3 py-1 dark:border-border-dark dark:bg-surface-dark">
        {LEADERBOARD.map((row, i) => (
          <View
            key={row.name}
            testID={`rewards_leader_${i}`}
            className={`flex-row items-center py-2.5 ${
              i < LEADERBOARD.length - 1 ? 'border-b border-border-light dark:border-border-dark' : ''
            }`}
          >
            <Text
              className={`w-6 text-sm font-bold ${
                i === 0 ? 'text-accent' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {i + 1}
            </Text>
            <Text
              className={`flex-1 text-sm ${
                row.you ? 'font-bold text-primary' : 'font-medium text-gray-900 dark:text-white'
              }`}
            >
              {row.name}
            </Text>
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="star-four-points" size={13} color="#F6A82B" />
              <Text className="ml-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {row.points.toLocaleString()}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text className="mb-1 px-1 text-base font-bold text-gray-900 dark:text-white">
        Redeem your coins
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Rewards store.
 * Lets the user spend Discova coins on partner perks. Redemption goes through
 * the firebase service (atomic Firestore transaction) and mirrors back into
 * the Zustand user store on success.
 */
export default function RewardsStoreScreen() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const updateCoins = useUserStore((s) => s.updateCoins);

  const [category, setCategory] = useState<CategoryKey>('all');
  const [redeem, setRedeem] = useState<RedeemState | null>(null);

  const coins = user?.coins ?? 0;

  const visibleRewards = useMemo<StoreReward[]>(
    () =>
      category === 'all'
        ? REWARDS
        : REWARDS.filter((r) => r.category === category),
    [category],
  );

  /** Step 1 — initial press on a card's Redeem button. */
  const handleRedeemPress = useCallback(
    (reward: StoreReward) => {
      if (coins < reward.cost) {
        const deficit = reward.cost - coins;
        Alert.alert(
          'Not enough coins',
          `You need ${deficit.toLocaleString()} more coins to redeem this reward. Keep posting to earn more!`,
          [{ text: 'OK' }],
        );
        return;
      }
      setRedeem({ reward, phase: 'confirm', code: '' });
    },
    [coins],
  );

  /** Step 2 — confirm the redemption: hit Firebase, mirror locally. */
  const handleConfirm = useCallback(async () => {
    if (!redeem || !user) return;
    setRedeem({ ...redeem, phase: 'submitting' });
    try {
      await fbRedeemReward(user.uid, redeem.reward.id, redeem.reward.cost);
      updateCoins(-redeem.reward.cost);
      setRedeem({
        ...redeem,
        phase: 'success',
        code: generateDiscountCode(),
      });
    } catch (e) {
      setRedeem(null);
      const message =
        e instanceof Error && /insufficient/i.test(e.message)
          ? "Your coin balance changed and isn't enough anymore."
          : 'Could not redeem right now. Please try again.';
      Alert.alert('Redemption failed', message, [{ text: 'OK' }]);
    }
  }, [redeem, user, updateCoins]);

  /** Close any open modal. */
  const handleClose = useCallback(() => {
    setRedeem(null);
  }, []);

  const renderRewardItem = ({ item }: ListRenderItemInfo<StoreReward>) => (
    <RewardCard
      reward={item}
      onRedeem={handleRedeemPress}
      affordable={coins >= item.cost}
    />
  );

  return (
    <SafeAreaView
      edges={['top']}
      className="flex-1 bg-surface-light dark:bg-surface-dark"
    >
      {/* Header — aurora gradient bar */}
      <LinearGradient
        testID="rewards_store_header"
        colors={[...AURORA]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Pressable
          testID="rewards_store_back"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/20"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
        <Text className="text-lg font-bold text-white">Rewards Store</Text>
        <View
          testID="rewards_store_coins_balance"
          className="flex-row items-center rounded-full bg-white/20 px-3 py-1.5"
        >
          <MaterialCommunityIcons name="star-four-points" size={14} color="#FFFFFF" />
          <Text className="ml-1 text-sm font-semibold text-white">
            {coins.toLocaleString()}
          </Text>
        </View>
      </LinearGradient>

      {/* Category tabs */}
      <View
        testID="rewards_category_tabs_container"
        className="border-b border-border-light dark:border-border-dark"
      >
        <ScrollView
          testID="rewards_category_tabs"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
        >
          {CATEGORIES.map((cat) => {
            const selected = category === cat.key;
            return (
              <Pressable
                key={cat.key}
                testID={`rewards_category_${cat.key}`}
                onPress={() => setCategory(cat.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`mr-2 h-9 flex-row items-center rounded-full px-3 ${
                  selected
                    ? 'bg-primary'
                    : 'bg-muted-light dark:bg-muted-dark'
                }`}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={selected ? '#FFFFFF' : '#6B7280'}
                />
                <Text
                  className={`ml-1.5 text-xs font-semibold ${
                    selected
                      ? 'text-white'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 2-column reward grid */}
      <FlatList
        testID="rewards_grid"
        data={visibleRewards}
        keyExtractor={(item) => item.id}
        renderItem={renderRewardItem}
        numColumns={2}
        contentContainerStyle={{ padding: 8, paddingBottom: 24 }}
        ListHeaderComponent={<RewardsHeader />}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Ionicons
              name="gift-outline"
              size={36}
              className="text-gray-400 dark:text-gray-500"
            />
            <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No rewards in this category yet.
            </Text>
          </View>
        }
      />

      {/* Confirm modal */}
      <Modal
        transparent
        animationType="fade"
        visible={redeem !== null && (redeem.phase === 'confirm' || redeem.phase === 'submitting')}
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          {redeem ? (
            <View
              testID="rewards_confirm_modal"
              className="w-full max-w-sm rounded-3xl bg-surface-light p-5 dark:bg-surface-dark"
            >
              <View className="items-center">
                <Text className="text-5xl">{redeem.reward.icon}</Text>
                <Text className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                  Redeem {redeem.reward.title}?
                </Text>
                <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
                  {redeem.reward.description}
                </Text>
                <View className="mt-3 flex-row items-center rounded-full bg-accent/15 px-3 py-1.5">
                  <MaterialCommunityIcons
                    name="star-four-points"
                    size={14}
                    color="#F59E0B"
                  />
                  <Text className="ml-1 text-sm font-semibold text-accent-dark">
                    {redeem.reward.cost.toLocaleString()} coins
                  </Text>
                </View>
                <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Balance after redemption: {(coins - redeem.reward.cost).toLocaleString()}
                </Text>
              </View>

              <View className="mt-5 flex-row">
                <Pressable
                  testID="rewards_confirm_cancel"
                  onPress={handleClose}
                  disabled={redeem.phase === 'submitting'}
                  accessibilityRole="button"
                  className="mr-2 h-12 flex-1 items-center justify-center rounded-2xl border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark"
                >
                  <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  testID="rewards_confirm_confirm"
                  onPress={handleConfirm}
                  disabled={redeem.phase === 'submitting'}
                  accessibilityRole="button"
                  className="ml-2 h-12 flex-1 items-center justify-center rounded-2xl bg-primary"
                >
                  {redeem.phase === 'submitting' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-sm font-semibold text-white">
                      Confirm
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Success / QR modal */}
      <Modal
        transparent
        animationType="fade"
        visible={redeem !== null && redeem.phase === 'success'}
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          {redeem && redeem.phase === 'success' ? (
            <View
              testID="rewards_qr_modal"
              className="w-full max-w-sm rounded-3xl bg-surface-light p-6 dark:bg-surface-dark"
            >
              <View className="items-center">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-success/15">
                  <Ionicons name="checkmark" size={28} color="#10B981" />
                </View>
                <Text className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                  Redemption successful
                </Text>
                <Text className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
                  Show this code at {redeem.reward.partner}.
                </Text>

                <View className="mt-4">
                  <QRPlaceholder />
                </View>

                <View
                  testID="rewards_qr_code"
                  className="mt-4 rounded-xl bg-muted-light px-4 py-2 dark:bg-muted-dark"
                >
                  <Text className="text-base font-bold tracking-widest text-gray-900 dark:text-white">
                    {redeem.code}
                  </Text>
                </View>

                <Text className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                  Valid for 30 days · One-time use
                </Text>
              </View>

              <Pressable
                testID="rewards_qr_close"
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                className="mt-6 h-12 items-center justify-center rounded-2xl bg-primary"
              >
                <Text className="text-sm font-semibold text-white">Done</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
