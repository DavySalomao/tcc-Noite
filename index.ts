import { registerRootComponent } from 'expo';
import notifee, { AndroidImportance } from '@notifee/react-native';

notifee.createChannel({
  id: 'alarme',
  name: 'Alarme de Remédios',
  importance: AndroidImportance.HIGH,
  sound: 'default',
  vibration: true,
  lights: true,
});


import App from './App';

registerRootComponent(App);
