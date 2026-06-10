import './global.css';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-surface-dark">
      <Text className="text-base text-gray-900 dark:text-white">
        Discova — open App.tsx to start
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}
