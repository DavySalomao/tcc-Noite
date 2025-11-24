import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ESP_IP_KEY = '@medtime_esp_ip';
const DEFAULT_IP = 'http://192.168.4.1';

interface EspIpContextData {
    espIp: string;
    setEspIp: (ip: string) => Promise<void>;
    resetToDefault: () => Promise<void>;
    loading: boolean;
}

const EspIpContext = createContext<EspIpContextData>({} as EspIpContextData);

export function EspIpProvider({ children }: { children: ReactNode }) {
    const [espIp, setEspIpState] = useState(DEFAULT_IP);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSavedIp();
    }, []);

    const loadSavedIp = async () => {
        try {
            const saved = await AsyncStorage.getItem(ESP_IP_KEY);
            console.log('[EspIpContext] IP carregado do AsyncStorage:', saved);
            if (saved) {
                setEspIpState(saved);
            }
        } catch (e) {
            console.log('[EspIpContext] Erro ao carregar IP:', e);
        } finally {
            setLoading(false);
        }
    };

    const setEspIp = async (ip: string) => {
        try {
            const formattedIp = ip.startsWith('http') ? ip : `http://${ip}`;
            console.log('[EspIpContext] Salvando novo IP:', formattedIp);
            await AsyncStorage.setItem(ESP_IP_KEY, formattedIp);
            setEspIpState(formattedIp);
        } catch (e) {
            console.log('[EspIpContext] Erro ao salvar IP:', e);
        }
    };

    const resetToDefault = async () => {
        try {
            await AsyncStorage.removeItem(ESP_IP_KEY);
            setEspIpState(DEFAULT_IP);
        } catch (e) {
            // Silent error handling
        }
    };

    return (
        <EspIpContext.Provider value={{ espIp, setEspIp, resetToDefault, loading }}>
            {children}
        </EspIpContext.Provider>
    );
}

export function useEspIp() {
    const context = useContext(EspIpContext);
    if (!context) {
        throw new Error('useEspIp deve ser usado dentro de um EspIpProvider');
    }
    return context;
}
