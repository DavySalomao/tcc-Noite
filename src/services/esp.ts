import axios from 'axios';

export const defaultAP = 'http://192.168.4.1';

export async function setAlarm(espIp: string, hour: string, minute: string, led: number, name?: string) {
    const base = espIp || defaultAP;
    const body = `hour=${encodeURIComponent(hour)}&minute=${encodeURIComponent(minute)}&led=${led}${name ? `&name=${encodeURIComponent(name)}` : ''}`;
    return axios.post(`${base}/setAlarm`, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
}


export async function listAlarms(espIp: string) {
    const base = espIp || defaultAP;
    return axios.get(`${base}/listAlarms`);
}


export async function deleteAlarm(espIp: string, id: number) {
    const base = espIp || defaultAP;
    return axios.post(`${base}/deleteAlarm`, `id=${id}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
}


export async function getStatus(espIp: string) {
    const base = espIp || defaultAP;
    return axios.get(`${base}/status`);
}


export async function getActive(espIp: string) {
    const base = espIp || defaultAP;
    return axios.get(`${base}/active`);
}


export async function stopAlarm(espIp: string, id?: number) {
    const base = espIp || defaultAP;
    const body = id ? `id=${id}` : '';
    return axios.post(`${base}/stopAlarm`, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
}


// Envia SSID/senha ao ESP (modo AP) — o ESP precisa ter um endpoint /configure que aplique as credenciais
export async function configureWiFi(espIp: string, ssid: string, pass: string) {
    const base = espIp || defaultAP;
    const body = `ssid=${encodeURIComponent(ssid)}&pass=${encodeURIComponent(pass)}`;
    return axios.post(`${base}/configure`, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
}