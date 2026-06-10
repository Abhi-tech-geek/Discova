import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WordmarkMark } from '../components/design/Wordmark';
import { ScorePill } from '../components/design/ScorePill';
import { COLORS } from '../components/design/theme';
import { useLiveLocation } from '../hooks/useLiveLocation';
import { askAgent, typesForQuery } from '../services/agents/askAgent';
import {
  getNearbyAttractions,
  getNearbyByTypes,
  nearbyToPlace,
} from '../services/googleMaps';
import { sanitizeInput } from '../utils/sanitize';
import type { Place } from '../types';

/** One chat bubble: user text, assistant text, or assistant place results. */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  places?: Place[];
}

const SUGGESTIONS = [
  'Quiet wheelchair-friendly cafe near me',
  'Family spot for this evening',
  'Calm place to relax nearby',
  'Step-free restaurant for dinner',
];

/** Small tappable result card inside an assistant bubble. */
function ResultCard({ place, onPress, index }: { place: Place; onPress: () => void; index: number }) {
  return (
    <Pressable
      testID={`ask_result_${index}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${place.name}`}
      className="mt-2 flex-row items-center overflow-hidden rounded-2xl border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark"
    >
      <View style={{ width: 64, height: 64, backgroundColor: 'rgba(150,160,176,0.2)' }}>
        {place.photos[0] ? (
          <Image source={{ uri: place.photos[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : null}
      </View>
      <View className="flex-1 px-3 py-2">
        <Text numberOfLines={1} className="text-sm font-semibold text-gray-900 dark:text-white">
          {place.name}
        </Text>
        <View className="mt-0.5 flex-row items-center" style={{ gap: 8 }}>
          <View className="flex-row items-center" style={{ gap: 3 }}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text className="text-xs text-gray-600 dark:text-gray-300">{place.rating.toFixed(1)}</Text>
          </View>
          {place.accessibilityScores.overall > 0 ? (
            <ScorePill score={place.accessibilityScores.overall} size="sm" />
          ) : (
            <Text className="text-[11px] text-gray-400">tap to check access</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.ink3} style={{ marginRight: 10 }} />
    </Pressable>
  );
}

/**
 * Ask DISCOVA — natural-language place finder. Type what you need; the agent
 * searches REAL nearby places (Google) and answers with tappable picks.
 */
export default function AskScreen() {
  const router = useRouter();
  const { location: userLocation, label: locationLabel } = useLiveLocation();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'hello',
      role: 'assistant',
      text: "Hi! I'm Discova. Ask me for places in plain words — like “quiet wheelchair-friendly cafe near me”.",
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  /** Send a question → fetch real candidates → agent answers. */
  const send = useCallback(
    async (raw: string) => {
      const query = sanitizeInput(raw, 200);
      if (query.length === 0 || thinking) return;

      setMessages((m) => [...m, { id: `u_${Date.now()}`, role: 'user', text: query }]);
      setInput('');
      setThinking(true);

      try {
        if (!userLocation) {
          setMessages((m) => [
            ...m,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              text: "I can't see your location yet — please allow location access, then ask again.",
            },
          ]);
          return;
        }

        // Real candidates from Google for the query's categories.
        const types = typesForQuery(query);
        const nearby =
          types.length > 0
            ? await getNearbyByTypes(userLocation, 6000, types)
            : await getNearbyAttractions(userLocation, 6000);
        const city = locationLabel.split(',').pop()?.trim() || 'Nearby';
        const candidates = nearby.map((np) => nearbyToPlace(np, city));

        const result = await askAgent.ask(query, candidates);
        setMessages((m) => [
          ...m,
          { id: `a_${Date.now()}`, role: 'assistant', text: result.reply, places: result.places },
        ]);
      } catch {
        setMessages((m) => [
          ...m,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            text: 'Something went wrong — please check your connection and try again.',
          },
        ]);
      } finally {
        setThinking(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
      }
    },
    [thinking, userLocation, locationLabel],
  );

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      if (item.role === 'user') {
        return (
          <View className="mb-3 max-w-[80%] self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5">
            <Text className="text-sm leading-5 text-white">{item.text}</Text>
          </View>
        );
      }
      return (
        <View className="mb-3 max-w-[88%] self-start">
          <View className="rounded-2xl rounded-bl-md border border-border-light bg-surface-light px-3.5 py-2.5 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-sm leading-5 text-gray-900 dark:text-white">{item.text}</Text>
          </View>
          {item.places?.map((p, i) => (
            <ResultCard
              key={p.id}
              place={p}
              index={i}
              onPress={() => router.push({ pathname: '/place/[id]', params: { id: p.id } })}
            />
          ))}
        </View>
      );
    },
    [router],
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg dark:bg-surface-dark">
      {/* Header */}
      <View className="flex-row items-center border-b border-border-light px-3 py-2 dark:border-border-dark">
        <Pressable
          testID="ask_back"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.ink3} />
        </Pressable>
        <View className="ml-2 flex-row items-center" style={{ gap: 8 }}>
          <WordmarkMark size={28} />
          <View>
            <Text className="text-base font-bold text-gray-900 dark:text-white">Ask Discova</Text>
            <Text className="text-[11px] text-gray-500 dark:text-gray-400">
              AI place finder · real places near you
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <FlatList
          ref={listRef}
          testID="ask_messages"
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 14, paddingBottom: 18 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            thinking ? (
              <View className="mb-3 flex-row items-center self-start rounded-2xl border border-border-light bg-surface-light px-3.5 py-2.5 dark:border-border-dark dark:bg-surface-dark">
                <ActivityIndicator size="small" color={COLORS.brand} />
                <Text className="ml-2 text-sm text-gray-500 dark:text-gray-400">Finding places…</Text>
              </View>
            ) : null
          }
        />

        {/* Suggestion chips (first turn only) */}
        {messages.length <= 1 ? (
          <View className="flex-row flex-wrap px-3 pb-2">
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                testID="ask_suggestion"
                onPress={() => void send(s)}
                accessibilityRole="button"
                className="mb-2 mr-2 rounded-full border border-border-light bg-surface-light px-3 py-2 dark:border-border-dark dark:bg-surface-dark"
              >
                <Text className="text-xs text-gray-700 dark:text-gray-200">{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Input bar */}
        <SafeAreaView edges={['bottom']} className="bg-bg dark:bg-surface-dark">
          <View className="flex-row items-center px-3 pb-2 pt-1" style={{ gap: 8 }}>
            <View className="flex-1 flex-row items-center rounded-full bg-muted-light px-4 py-1 dark:bg-muted-dark">
              <MaterialCommunityIcons name="star-four-points" size={15} color={COLORS.brand} />
              <TextInput
                testID="ask_input"
                value={input}
                onChangeText={setInput}
                placeholder="Ask for a place…"
                placeholderTextColor="#9CA3AF"
                returnKeyType="send"
                onSubmitEditing={() => void send(input)}
                editable={!thinking}
                className="ml-2 flex-1 py-2 text-sm text-gray-900 dark:text-white"
              />
            </View>
            <Pressable
              testID="ask_send"
              onPress={() => void send(input)}
              disabled={thinking || input.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Send"
              className={`h-11 w-11 items-center justify-center rounded-full ${
                thinking || input.trim().length === 0 ? 'bg-muted-light dark:bg-muted-dark' : 'bg-primary'
              }`}
            >
              <Ionicons
                name="arrow-up"
                size={20}
                color={thinking || input.trim().length === 0 ? '#9CA3AF' : '#FFFFFF'}
              />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
