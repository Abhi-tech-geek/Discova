import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AURORA, COLORS } from '../../components/design/theme';
import { useTheme } from '../../hooks/useTheme';

const ACTIVE_TINT = COLORS.brand;
const INACTIVE_LIGHT = COLORS.ink3;
const INACTIVE_DARK = '#7A8190';

const BG_LIGHT = '#FFFFFF';
const BG_DARK = '#0E1118';
const BORDER_LIGHT = COLORS.hairline;
const BORDER_DARK = '#1F2530';

/** Subset of BottomTabBarButtonProps we actually consume. */
type CameraTabButtonProps = Pick<
  BottomTabBarButtonProps,
  'onPress' | 'accessibilityLabel' | 'testID'
>;

/**
 * Raised camera FAB rendered between the Explore and Search tabs.
 * Aurora gradient pill that lifts above the tab-bar line for an Instagram-style
 * primary action.
 */
function CameraTabButton(props: CameraTabButtonProps) {
  const handlePress = (e: GestureResponderEvent): void => {
    props.onPress?.(e);
  };
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? 'Open camera'}
      testID={props.testID ?? 'tab_camera_button'}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <LinearGradient
        colors={[...AURORA]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -26,
          shadowColor: COLORS.brand,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.45,
          shadowRadius: 22,
          elevation: 10,
          borderWidth: 4,
          borderColor: '#FFFFFF',
        }}
      >
        <Ionicons name="camera" size={26} color="#FFFFFF" />
      </LinearGradient>
    </Pressable>
  );
}

/**
 * Bottom tab bar — five tabs: Home / Explore / Camera (raised) / Search / Profile.
 * Adopts the DISCOVA glass-light aesthetic.
 */
export default function TabsLayout() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    backgroundColor: isDark ? BG_DARK : BG_LIGHT,
    borderTopColor: isDark ? BORDER_DARK : BORDER_LIGHT,
    borderTopWidth: 1,
    height: 64 + insets.bottom,
    paddingBottom: insets.bottom,
    paddingTop: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: isDark ? 0.3 : 0.06,
    shadowRadius: 12,
    elevation: 12,
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0B0C10' : COLORS.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: ACTIVE_TINT,
          tabBarInactiveTintColor: isDark ? INACTIVE_DARK : INACTIVE_LIGHT,
          tabBarLabelStyle: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.1 },
          tabBarStyle,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarButtonTestID: 'tab_home',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={size - 1}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarButtonTestID: 'tab_explore',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? 'compass' : 'compass-outline'}
                size={size - 1}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="camera"
          options={{
            title: '',
            tabBarButtonTestID: 'tab_camera',
            tabBarLabel: () => null,
            tabBarButton: (props) => (
              <CameraTabButton
                onPress={props.onPress}
                accessibilityLabel={props.accessibilityLabel}
                testID={props.testID}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarButtonTestID: 'tab_search',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? 'search' : 'search-outline'}
                size={size - 1}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarButtonTestID: 'tab_profile',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={size - 1}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
