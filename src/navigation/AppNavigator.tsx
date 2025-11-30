import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AlarmsScreen from '../screens/AlarmsScreen';
import ConfigScreen from '../screens/ConfigScreen';
import WhatsAppConfigScreen from '../screens/WhatsAppConfigScreen';


const Stack = createStackNavigator();


export default function AppNavigator() {
    return (
        <Stack.Navigator>
            <Stack.Screen name="Medtime" component={AlarmsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Config" component={ConfigScreen} options={{ title: 'Configurar Wi‑Fi' }} />
            <Stack.Screen name="WhatsAppConfig" component={WhatsAppConfigScreen} options={{ title: 'WhatsApp' }} />
        </Stack.Navigator>
    );
}