import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/navigation/AppNavigator';
import { EspIpProvider } from './src/contexts/EspIpContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  useEffect(() => {

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notificação tocada:', response);

    });

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <EspIpProvider>
        <StatusBar style="light" />
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </EspIpProvider>
    </SafeAreaProvider>
  );
}