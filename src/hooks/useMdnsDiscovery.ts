import { useState, useCallback } from 'react';
import * as Network from 'expo-network';
import axios from 'axios';

interface DiscoveredDevice {
  name: string;
  host: string;
  addresses: string[];
  port: number;
}

export const useMdnsDiscovery = () => {
  const [discovering, setDiscovering] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [espDevice, setEspDevice] = useState<DiscoveredDevice | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Testa se um IP responde ao endpoint /ping do ESP
  const testEspAtIp = async (ip: string): Promise<boolean> => {
    try {
      const response = await axios.get(`http://${ip}/ping`, { timeout: 2500 });
      return response.data?.pong === true && response.data?.device === 'ESP8266';
    } catch {
      return false;
    }
  };

  // Obtém informações do ESP descoberto
  const getEspInfo = async (ip: string): Promise<DiscoveredDevice | null> => {
    try {
      const response = await axios.get(`http://${ip}/info`, { timeout: 2000 });
      if (response.data) {
        return {
          name: 'MedTime ESP8266',
          host: response.data.hostname || 'medtime.local',
          addresses: [ip],
          port: 80,
        };
      }
    } catch {
      // Se /info falhar, retorna info básica
      return {
        name: 'MedTime ESP8266',
        host: ip,
        addresses: [ip],
        port: 80,
      };
    }
    return null;
  };

  const startDiscovery = useCallback(async () => {
    setDiscovering(true);
    setError(null);
    setDevices([]);
    setEspDevice(null);

    try {
      const ip = await Network.getIpAddressAsync();

      if (!ip || ip === '0.0.0.0') {
        throw new Error('Dispositivo não conectado à rede WiFi');
      }

      const parts = ip.split('.');
      if (parts.length !== 4) {
        throw new Error('Formato de IP inválido');
      }
      const baseIp = `${parts[0]}.${parts[1]}.${parts[2]}`;

      const commonLastOctets = [100, 3, 2, 1, 101, 50, 10, 20, 30, 99, 254, 4, 5, 11, 12, 13];
      
      let found = false;
      for (const lastOctet of commonLastOctets) {
        if (found) break;
        
        const testIp = `${baseIp}.${lastOctet}`;
        
        if (testIp === ip) continue;
        
        const isEsp = await testEspAtIp(testIp);
        if (isEsp) {
          const deviceInfo = await getEspInfo(testIp);
          if (deviceInfo) {
            setEspDevice(deviceInfo);
            setDevices([deviceInfo]);
            setDiscovering(false);
            found = true;
            return;
          }
        }
      }

      if (!found) {
        const remainingIps: number[] = [];
        for (let i = 1; i <= 254; i++) {
          if (!commonLastOctets.includes(i)) {
            remainingIps.push(i);
          }
        }

        for (let i = 0; i < remainingIps.length && !found; i += 5) {
          const batch = remainingIps.slice(i, i + 5);
          const promises = batch.map(async (lastOctet) => {
            const testIp = `${baseIp}.${lastOctet}`;
            if (testIp === ip) return;
            
            const isEsp = await testEspAtIp(testIp);
            if (isEsp) {
              const deviceInfo = await getEspInfo(testIp);
              if (deviceInfo) {
                setEspDevice(deviceInfo);
                setDevices([deviceInfo]);
                setDiscovering(false);
                found = true;
              }
            }
          });

          await Promise.all(promises);
        }
      }

      if (!found) {
        setError('ESP não encontrado. Verifique se está ligado e conectado à mesma rede WiFi.');
      }

    } catch (err: any) {
      setError(err.message || 'Erro ao buscar ESP na rede');
    } finally {
      setDiscovering(false);
    }
  }, []);

  const stopDiscovery = useCallback(() => {
    setDiscovering(false);
  }, []);

  // Retorna URL completa do ESP
  const getEspUrl = useCallback((): string | null => {
    if (!espDevice || !espDevice.addresses || espDevice.addresses.length === 0) {
      return null;
    }
    return `http://${espDevice.addresses[0]}`;
  }, [espDevice]);

  return {
    discovering,
    devices,
    espDevice,
    espUrl: getEspUrl(),
    error,
    startDiscovery,
    stopDiscovery,
  };
};
