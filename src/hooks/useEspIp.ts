import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ESP_IP_KEY = '@medtime_esp_ip';
const DEFAULT_IP = 'http://192.168.4.1';

export function useEspIp() {
    const [espIp, setEspIpState] = useState(DEFAULT_IP);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSavedIp();
    }, []);

    const loadSavedIp = async () => {
        try {
            const saved = await AsyncStorage.getItem(ESP_IP_KEY);
            if (saved) {
                setEspIpState(saved);
            }
        } catch (e) {
            console.log('Erro ao carregar IP salvo:', e);
        } finally {
            setLoading(false);
        }
    };

    const setEspIp = async (ip: string) => {
        try {
            const formattedIp = ip.startsWith('http') ? ip : `http://${ip}`;
            await AsyncStorage.setItem(ESP_IP_KEY, formattedIp);
            setEspIpState(formattedIp);
        } catch (e) {
            console.log('Erro ao salvar IP:', e);
        }
    };

    const resetToDefault = async () => {
        try {
            await AsyncStorage.removeItem(ESP_IP_KEY);
            setEspIpState(DEFAULT_IP);
        } catch (e) {
            console.log('Erro ao resetar IP:', e);
        }
    };

    return { espIp, setEspIp, resetToDefault, loading };
}
