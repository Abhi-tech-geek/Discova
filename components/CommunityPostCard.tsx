/**
 * CommunityPostCard — a REAL user post in the home "Community" feed.
 * Shows the user's actual uploaded photo, caption, accessibility score, and
 * like/comment counts. Only rendered once real users start posting; until then
 * the Community tab shows an empty state.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { GradientAvatar } from './design/GradientAvatar';
import { ScorePill } from './design/ScorePill';
import { COLORS, surfaces } from './design/theme';
import { toggleLike as fbToggleLike } from '../services/firebase';
import { useAppStore } from '../stores/appStore';
import type { Post } from '../types';

/** "2h" / "1d" / "now" relative time. */
function relativeTime(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const m = 60_000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < m) return 'now';
  if (diff < h) return `${Math.floor(diff / m)}m`;
  if (diff < d) return `${Math.floor(diff / h)}h`;
  return `${Math.floor(diff / d)}d`;
}

/** 1.2k / 3.4M compact count. */
function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export interface CommunityPostCardProps {
  post: Post;
  currentUserId: string;
  onPress: () => void;
  index: number;
}

export function CommunityPostCard({ post, currentUserId, onPress, index }: CommunityPostCardProps) {
  const C = surfaces(useAppStore((s) => s.theme === 'dark'));
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);

  /** Optimistic like toggle with Firestore persist (revert on failure). */
  const handleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    fbToggleLike(post.id, currentUserId).catch(() => {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    });
  }, [liked, post.id, currentUserId]);

  return (
    <View
      testID={`home_community_post_${index}`}
      className="mx-3.5 mb-4 overflow-hidden rounded-3xl border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark"
    >
      {/* Header */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className="flex-row items-center px-3 py-2.5"
      >
        <GradientAvatar name={post.userDisplayName} photoURL={post.userPhotoURL} size={36} />
        <View className="ml-2.5 flex-1">
          <Text numberOfLines={1} className="text-sm font-semibold text-gray-900 dark:text-white">
            {post.userDisplayName}
          </Text>
          <Text numberOfLines={1} className="text-xs text-gray-500 dark:text-gray-400">
            {post.placeName} · {relativeTime(post.createdAt)}
          </Text>
        </View>
        {post.accessibilityScore > 0 ? (
          <ScorePill score={post.accessibilityScore * 10} size="sm" />
        ) : null}
      </Pressable>

      {/* Photo */}
      <Pressable onPress={onPress} accessibilityRole="imagebutton">
        <View style={{ width: '100%', aspectRatio: 4 / 5, backgroundColor: C.surface2 }}>
          {post.imageUrl ? (
            <Image source={{ uri: post.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Ionicons name="image-outline" size={32} color={C.ink3} />
            </View>
          )}
        </View>
      </Pressable>

      {/* Actions */}
      <View className="flex-row items-center px-3.5 py-3" style={{ gap: 18 }}>
        <Pressable
          testID={`home_community_post_${index}_like`}
          onPress={handleLike}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          className="flex-row items-center"
          style={{ gap: 5 }}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={23} color={liked ? COLORS.like : C.ink} />
          <Text className="text-sm font-bold text-gray-900 dark:text-white">{compactCount(likes)}</Text>
        </Pressable>
        <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center" style={{ gap: 5 }}>
          <Ionicons name="chatbubble-outline" size={21} color={C.ink} />
          <Text className="text-sm font-bold text-gray-900 dark:text-white">{compactCount(post.commentsCount)}</Text>
        </Pressable>
        <Ionicons name="paper-plane-outline" size={21} color={C.ink} />
      </View>

      {/* Caption */}
      {post.caption.length > 0 || post.aiCaption.length > 0 ? (
        <Text className="px-3.5 pb-3.5 text-sm leading-5 text-gray-800 dark:text-gray-100">
          <Text className="font-semibold text-gray-900 dark:text-white">{post.userDisplayName} </Text>
          {post.caption || post.aiCaption}
        </Text>
      ) : null}
    </View>
  );
}
