import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { testConnection } from '../services/esp';
import { useMdnsDiscovery } from '../hooks/useMdnsDiscovery';

const ESP_IP_KEY = '@medtime_esp_ip';
const DEFAULT_IP = 'http://medtime.local'; // mDNS automático

interface EspIpContextData {
    espIp: string;
    setEspIp: (ip: string) => Promise<void>;
    resetToDefault: () => Promise<void>;
    loading: boolean;
    isConnected: boolean;
    testEspConnection: () => Promise<boolean>;
    autoDiscoverEsp: () => void;
    discovering: boolean;
}

const EspIpContext = createContext<EspIpContextData>({} as EspIpContextData);

export function EspIpProvider({ children }: { children: ReactNode }) {
    const [espIp, setEspIpState] = useState(DEFAULT_IP);
    const [loading, setLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    
    // Hook de descoberta mDNS
    const { discovering, espUrl, startDiscovery, stopDiscovery } = useMdnsDiscovery();

    useEffect(() => {
        loadSavedIp();
    }, []);
    
    // Atualiza IP automaticamente quando ESP é descoberto
    useEffect(() => {
        if (espUrl && espUrl !== espIp) {
            console.log('🎯 ESP descoberto automaticamente:', espUrl);
            setEspIpState(espUrl);
            AsyncStorage.setItem(ESP_IP_KEY, espUrl);
            setIsConnected(true);
            stopDiscovery(); // Para o scan quando encontrar
        }
    }, [espUrl]);

    const loadSavedIp = async () => {
        try {
            const saved = await AsyncStorage.getItem(ESP_IP_KEY);
            if (saved) {
                setEspIpState(saved);
                // Testa conexão com o IP salvo
                const connected = await testConnection(saved);
                setIsConnected(connected);
                
                // Se não conectar com IP salvo, inicia descoberta automática
                if (!connected) {
                    console.log('⚠️ IP salvo não está acessível, iniciando busca automática...');
                    startDiscovery();
                    
                    // Para o scan após 15 segundos
                    setTimeout(() => {
                        stopDiscovery();
                        setLoading(false);
                    }, 15000);
                } else {
                    setLoading(false);
                }
            } else {
                // Primeira vez: inicia descoberta automática
                console.log('🔍 Primeira vez, buscando ESP automaticamente...');
                startDiscovery();
                
                // Para o scan após 15 segundos
                setTimeout(() => {
                    stopDiscovery();
                    setLoading(false);
                }, 15000);
            }
        } catch {
            setLoading(false);
        }
    };

    const autoDiscoverEsp = () => {
        console.log('🔄 Iniciando descoberta manual...');
        startDiscovery();
        
        // Para automaticamente após 20 segundos
        setTimeout(() => {
            stopDiscovery();
        }, 20000);
    };

    const testEspConnection = async (): Promise<boolean> => {
        const connected = await testConnection(espIp);
        setIsConnected(connected);
        return connected;
    };

    const setEspIp = async (ip: string) => {
        try {
            const formattedIp = ip.startsWith('http') ? ip : `http://${ip}`;
            await AsyncStorage.setItem(ESP_IP_KEY, formattedIp);
            setEspIpState(formattedIp);
            
            // Testa conexão com novo IP
            const connected = await testConnection(formattedIp);
            setIsConnected(connected);
        } catch { }
    };

    const resetToDefault = async () => {
        try {
            await AsyncStorage.removeItem(ESP_IP_KEY);
            setEspIpState(DEFAULT_IP);
            const connected = await testConnection(DEFAULT_IP);
            setIsConnected(connected);
        } catch (e) { }
    };

    return (
        <EspIpContext.Provider value={{ 
            espIp, 
            setEspIp, 
            resetToDefault, 
            loading, 
            isConnected, 
            testEspConnection,
            autoDiscoverEsp,
            discovering
        }}>
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
