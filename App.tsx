import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/navigation/AppNavigator';
import { EspIpProvider } from './src/contexts/EspIpContext';

// Configuração do comportamento das notificações quando o app está em primeiro plano
// Nota: Notificações remotas não funcionam no Expo Go a partir do SDK 53
// Para usar notificações remotas, é necessário criar um development build
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
    // Listener para quando o usuário toca em uma notificação
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notificação tocada:', response);
      // Aqui você pode navegar para uma tela específica se necessário
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