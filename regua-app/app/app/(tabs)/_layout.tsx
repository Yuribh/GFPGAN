import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { c } from '../../src/theme.ts';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: c.accent,
      tabBarInactiveTintColor: c.muted,          // AA contrast, unlike the original's light grey
      tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
      sceneStyle: { backgroundColor: c.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color }) => <Feather name="home" size={24} color={color} /> }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favoritos', tabBarIcon: ({ color }) => <Feather name="heart" size={24} color={color} /> }} />
      <Tabs.Screen name="about" options={{ title: 'Sobre', tabBarIcon: ({ color }) => <Feather name="info" size={24} color={color} /> }} />
    </Tabs>
  );
}
