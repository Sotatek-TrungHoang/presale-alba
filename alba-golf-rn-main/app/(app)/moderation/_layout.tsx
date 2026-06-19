import { Stack } from 'expo-router';

export default function ModerationLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="dashboard" 
        options={{ 
          title: 'Moderation Dashboard',
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="reports" 
        options={{ 
          title: 'Reports',
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="content-review" 
        options={{ 
          title: 'Content Review',
          headerShown: true,
        }} 
      />
    </Stack>
  );
}

