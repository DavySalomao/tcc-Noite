import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { EspIpProvider } from './src/contexts/EspIpContext';

export default function App() {
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