/**
 * AccessibilityReport.
 * Five animated progress bars (mobility / visual / hearing / cognitive / sensory)
 * that fill from 0 to their score over 800 ms on mount.
 * Below the bars, positive and warning feature chips render in green and red.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Place } from '../types';

/** Props for `AccessibilityReport`. */
export interface AccessibilityReportProps {
  place: Place;
}

/** One row in the bars block. */
interface CategoryRow {
  key: 'mobility' | 'visual' | 'hearing' | 'cognitive' | 'sensory';
  label: string;
  score: number;
}

/** Pick the traffic-light fill color for a 0-100 score. */
function colorForScore(score: number): string {
  if (score >= 70) return 'bg-success';
  if (score >= 40) return 'bg-warning';
  return 'bg-danger';
}

/** Single animated bar. A score of 0 means "AI couldn't assess" — shown as
 *  a neutral "Not assessed" row, NOT a scary red 0. */
function ProgressBar({
  label,
  score,
  testID,
}: {
  label: string;
  score: number;
  testID: string;
}) {
  const width = useSharedValue(0);
  const fill = colorForScore(score);
  const assessed = score > 0;

  useEffect(() => {
    width.value = withTiming(assessed ? score : 0, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [score, assessed, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View testID={testID} className="mb-3">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}
        </Text>
        <Text
          className={`text-xs ${assessed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}
        >
          {assessed ? `${Math.round(score)}/100` : 'Not assessed'}
        </Text>
      </View>
      <View className="h-2 w-full overflow-hidden rounded-full bg-muted-light dark:bg-muted-dark">
        {assessed ? (
          <Animated.View style={animatedStyle} className={`h-2 rounded-full ${fill}`} />
        ) : null}
      </View>
    </View>
  );
}

interface Verdict {
  label: string;
  color: string;
  bg: string;
  icon: 'check-circle' | 'alert' | 'help-circle';
  note: string;
}

/**
 * Plain-language verdict, centred on WHEELCHAIR access (the core of this app).
 * Mobility 0 means "AI couldn't tell from the photo" — shown as a neutral
 * "not confirmed", never a misleading red verdict.
 */
function verdict(mobility: number, hasAnyScore: boolean): Verdict {
  if (mobility >= 70) {
    return { label: 'Wheelchair accessible', color: '#11A861', bg: 'bg-success/15', icon: 'check-circle', note: 'Step-free / ramp access detected.' };
  }
  if (mobility >= 40) {
    return { label: 'Partly wheelchair accessible', color: '#E0A100', bg: 'bg-warning/15', icon: 'alert', note: 'Some access, but check before you go.' };
  }
  if (mobility > 0) {
    return { label: 'Limited wheelchair access', color: '#E5484D', bg: 'bg-danger/15', icon: 'alert', note: 'Barriers detected — plan ahead.' };
  }
  return {
    label: 'Wheelchair access not confirmed',
    color: '#98A0B0',
    bg: 'bg-muted-light dark:bg-muted-dark',
    icon: 'help-circle',
    note: hasAnyScore
      ? 'Entrance not clear in the photo. Post an entrance photo to confirm.'
      : 'No photo analyzed yet.',
  };
}

/** Render the report. */
export function AccessibilityReport({ place }: AccessibilityReportProps) {
  const scores = place.accessibilityScores;
  const rows: CategoryRow[] = [
    { key: 'mobility', label: 'Wheelchair access', score: scores.mobility },
    { key: 'visual', label: 'Visual', score: scores.visual },
    { key: 'hearing', label: 'Hearing', score: scores.hearing },
    { key: 'cognitive', label: 'Cognitive', score: scores.cognitive },
    { key: 'sensory', label: 'Sensory', score: scores.sensory },
  ];

  const detected = place.aiAnalysis?.detectedFeatures ?? [];
  const warnings = place.aiAnalysis?.warningFeatures ?? [];
  const hasAnyScore =
    scores.mobility + scores.visual + scores.hearing + scores.cognitive + scores.sensory > 0;
  const v = verdict(scores.mobility, hasAnyScore);

  return (
    <View
      testID="accessibility_report"
      className="rounded-2xl bg-surface-light p-4 dark:bg-surface-dark"
    >
      <Text className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
        Accessibility Report
      </Text>

      {/* Plain-language verdict — centred on wheelchair access */}
      <View
        testID="accessibility_report_verdict"
        className={`mb-4 flex-row items-center rounded-xl px-3 py-2.5 ${v.bg}`}
      >
        <MaterialCommunityIcons name={v.icon} size={20} color={v.color} />
        <View className="ml-2 flex-1">
          <Text className="text-sm font-bold" style={{ color: v.color }}>
            {v.label}
          </Text>
          <Text className="text-xs text-gray-600 dark:text-gray-300">{v.note}</Text>
        </View>
      </View>

      {/* AI summary line */}
      {place.aiAnalysis?.summary ? (
        <Text className="mb-3 text-xs leading-5 text-gray-600 dark:text-gray-300">
          {place.aiAnalysis.summary}
        </Text>
      ) : null}

      {rows.map((row) => (
        <ProgressBar
          key={row.key}
          label={row.label}
          score={row.score}
          testID={`accessibility_report_bar_${row.key}`}
        />
      ))}

      {detected.length > 0 ? (
        <View className="mt-3">
          <Text className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Detected features
          </Text>
          <View className="flex-row flex-wrap">
            {detected.map((feature, i) => (
              <View
                key={`detected-${i}`}
                testID={`accessibility_report_chip_detected_${i}`}
                className="mb-2 mr-2 flex-row items-center rounded-full bg-success/15 px-2.5 py-1"
              >
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text className="ml-1 text-xs font-medium text-success">
                  {feature}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {warnings.length > 0 ? (
        <View className="mt-2">
          <Text className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Watch outs
          </Text>
          <View className="flex-row flex-wrap">
            {warnings.map((feature, i) => (
              <View
                key={`warning-${i}`}
                testID={`accessibility_report_chip_warning_${i}`}
                className="mb-2 mr-2 flex-row items-center rounded-full bg-danger/15 px-2.5 py-1"
              >
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
                <Text className="ml-1 text-xs font-medium text-danger">
                  {feature}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
