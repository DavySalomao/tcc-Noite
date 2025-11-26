import axios from 'axios';

export const defaultAP = 'http://192.168.4.1';

// Configuração global do axios com timeout aumentado
const axiosInstance = axios.create({
    timeout: 8000, // 8 segundos de timeout
});

// Função auxiliar para retry automático
async function retryRequest<T>(
    fn: () => Promise<T>,
    retries: number = 2,
    delay: number = 1000
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryRequest(fn, retries - 1, delay);
        }
        throw error;
    }
}

export async function setAlarm(espIp: string, hour: string, minute: string, led: number, name?: string) {
    const base = espIp || defaultAP;
    const body = `hour=${encodeURIComponent(hour)}&minute=${encodeURIComponent(minute)}&led=${led}${name ? `&name=${encodeURIComponent(name)}` : ''}`;
    return retryRequest(() => 
        axiosInstance.post(`${base}/setAlarm`, body, { 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
        })
    );
}


export async function listAlarms(espIp: string) {
    const base = espIp || defaultAP;
    return retryRequest(() => axiosInstance.get(`${base}/listAlarms`));
}


export async function deleteAlarm(espIp: string, id: number) {
    const base = espIp || defaultAP;
    return retryRequest(() =>
        axiosInstance.post(`${base}/deleteAlarm`, `id=${id}`, { 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
        })
    );
}


export async function getStatus(espIp: string) {
    const base = espIp || defaultAP;
    // Status check sem retry para não acumular requisições
    return axiosInstance.get(`${base}/status`, { timeout: 5000 });
}


export async function getActive(espIp: string) {
    const base = espIp || defaultAP;
    // Active check sem retry para polling rápido, com timeout reduzido para 2s
    return axiosInstance.get(`${base}/active`, { timeout: 2000 });
}


export async function stopAlarm(espIp: string, id?: number) {
    const base = espIp || defaultAP;
    const body = id ? `id=${id}` : '';
    return retryRequest(() =>
        axiosInstance.post(`${base}/stopAlarm`, body, { 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
        })
    );
}


// Envia SSID/senha ao ESP (modo AP) — o ESP precisa ter um endpoint /configure que aplique as credenciais
export async function configureWiFi(espIp: string, ssid: string, pass: string) {
    const base = espIp || defaultAP;
    const body = `ssid=${encodeURIComponent(ssid)}&pass=${encodeURIComponent(pass)}`;
    // Configure precisa de timeout maior pois ESP demora para conectar
    return axiosInstance.post(`${base}/configure`, body, { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 25000 // 25 segundos para configuração WiFi
    });
}

// Reseta a EEPROM do ESP (limpa credenciais WiFi salvas)
export async function resetEsp(espIp: string) {
    const base = espIp || defaultAP;
    return retryRequest(() =>
        axiosInstance.post(`${base}/reset`, '', { 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
        })
    );
}