import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, StyleSheet, Switch, Image, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AlarmModal from '../components/AlarmModal';
import { listAlarms, setAlarm, deleteAlarm, getStatus, getActive, stopAlarm } from '../services/esp';
import { Ionicons } from '@expo/vector-icons';

type AlarmType = { id: number; hour: string; minute: string; name: string; led: number; enabled: boolean };
type AlertItem = { id: number; timestamp: number; title: string; message: string };

export default function AlarmsScreen({ navigation }: any) {
    const [alarms, setAlarms] = useState<AlarmType[]>([]);
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [espIp, setEspIp] = useState('http://192.168.0.5');

    const [horaAtual, setHoraAtual] = useState('--:--');
    const [status, setStatus] = useState('Desconhecido');
    const [tab, setTab] = useState<'alarms' | 'alerts'>('alarms');

    const [showModal, setShowModal] = useState(false);
    const [tempHour, setTempHour] = useState('');
    const [tempMinute, setTempMinute] = useState('');
    const [tempName, setTempName] = useState('');
    const [tempLed, setTempLed] = useState(0);
    const [activeField, setActiveField] = useState<'hour' | 'minute'>('hour');

    const activeFetchedRef = useRef<number | null>(null);

    useEffect(() => {
        (async () => {
            await registerForPushNotificationsAsync();
            if (Device.osName === 'Android') {
                try {
                    await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.HIGH, sound: 'default' });
                } catch { }
            }
        })();

        load();
        loadAlerts();
        const t = setInterval(() => { pollActive(); atualizarStatus(); }, 2000);
        return () => clearInterval(t);
    }, []);

    async function registerForPushNotificationsAsync() {
        try {
            if (!Device || !Device.isDevice) return null;
            const { status: existing } = await Notifications.getPermissionsAsync();
            let finalStatus = existing;
            if (existing !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') return null;
            const token = (await Notifications.getExpoPushTokenAsync()).data;
            return token;
        } catch { return null; }
    }

    async function load() {
        try {
            const r = await AsyncStorage.getItem('alarms');
            if (r) setAlarms(JSON.parse(r));
        } catch (e) { console.warn('load alarms', e); }
    }

    async function loadAlerts() {
        try {
            const r = await AsyncStorage.getItem('alerts');
            if (r) setAlerts(JSON.parse(r));
        } catch { }
    }

    async function saveAlarms(next: AlarmType[]) {
        try {
            setAlarms(next);
            await AsyncStorage.setItem('alarms', JSON.stringify(next));
            enviarProximo(next);
        } catch (e) { console.error('saveAlarms', e); }
    }

    async function saveAlerts(next: AlertItem[]) {
        try { setAlerts(next); await AsyncStorage.setItem('alerts', JSON.stringify(next)); } catch { }
    }

    const pushAlert = async (title: string, message: string) => {
        const item: AlertItem = { id: Date.now() ^ Math.floor(Math.random() * 1000), timestamp: Date.now(), title, message };
        await saveAlerts([item, ...alerts]);
    };

    const abrirAlarmPicker = () => {
        setTempHour(''); setTempMinute(''); setTempName(''); setTempLed(0); setActiveField('hour'); setShowModal(true);
    };

    // digitação
    const adicionarNumero = (num: string) => {
        if (activeField === 'hour') {
            const newHour = tempHour + num;
            if (newHour.length <= 2) {
                setTempHour(newHour);
                if (newHour.length === 2 || (newHour.length === 1 && parseInt(newHour) > 2)) setActiveField('minute');
            }
        } else {
            const newMinute = tempMinute + num;
            if (newMinute.length <= 2) setTempMinute(newMinute);
        }
    };

    const apagar = () => {
        if (tempMinute.length > 0) { setTempMinute(s => s.slice(0, -1)); setActiveField('minute'); }
        else if (tempHour.length > 0) { setTempHour(s => s.slice(0, -1)); setActiveField('hour'); }
    };

    const salvarNovoAlarme = async () => {
        const hora = parseInt(tempHour || '0', 10); const minuto = parseInt(tempMinute || '0', 10); const nome = tempName.trim() || 'Alarme';
        if (isNaN(hora) || hora < 0 || hora > 23 || isNaN(minuto) || minuto < 0 || minuto > 59) { Alert.alert('Horário inválido', 'Informe um horário entre 00:00 e 23:59'); return; }
        const novo: AlarmType = { id: Date.now(), hour: hora.toString().padStart(2, '0'), minute: minuto.toString().padStart(2, '0'), name: nome, led: tempLed, enabled: true };
        const novos = [...alarms, novo];
        await saveAlarms(novos);
        setShowModal(false);
    };

    const alternarAlarme = async (id: number) => {
        const novos = alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
        await saveAlarms(novos);
    };

    const excluirAlarme = async (id: number) => {
        const novos = alarms.filter(a => a.id !== id);
        await saveAlarms(novos);
        await pushAlert('Alarme excluído', `ID ${id} removido`);
        try { await deleteAlarm(espIp, id); } catch { }
    };

    const enviarProximo = async (lista = alarms) => {
        const ativos = lista.filter(a => a.enabled);
        if (ativos.length === 0) return;
        const agora = new Date(); const agoraMin = agora.getHours() * 60 + agora.getMinutes();
        const proximo = ativos.reduce((menor: AlarmType | null, atual) => {
            const minutosAtual = parseInt(atual.hour) * 60 + parseInt(atual.minute);
            const diffAtual = (minutosAtual - agoraMin + 1440) % 1440;
            const diffMenor = menor ? (parseInt(menor.hour) * 60 + parseInt(menor.minute) - agoraMin + 1440) % 1440 : Infinity;
            return diffAtual < diffMenor ? atual : menor;
        }, null as AlarmType | null);
        if (proximo) {
            try { await setAlarm(espIp, proximo.hour, proximo.minute, proximo.led, proximo.name); await pushAlert('Alarme agendado', `LED ${proximo.led + 1} às ${proximo.hour}:${proximo.minute}`); } catch { Alert.alert('Erro', 'Falha ao enviar alarme ao ESP'); }
        }
    };

    const pollActive = async () => {
        try {
            const res = await getActive(espIp);
            if (res.data?.active) {
                if (activeFetchedRef.current !== res.data.id) {
                    activeFetchedRef.current = res.data.id;
                    setActiveAlarm(res.data);
                    const msg = `Hora do remédio "${res.data.name}", LED ${res.data.led + 1}.`;
                    await pushAlert('Alerta de remédio', msg);
                    try { await Notifications.scheduleNotificationAsync({ content: { title: 'Hora do remédio', body: msg, sound: 'default' }, trigger: null }); } catch { }
                }
            } else {
                activeFetchedRef.current = null;
                setActiveAlarm(null);
            }
        } catch { }
    };

    const confirmarAlarmeAtivo = async (id?: number) => {
        try { await stopAlarm(espIp, id); await pushAlert('Alarme confirmado', `Confirmado`); Alert.alert('Confirmado', 'Alarme interrompido.'); } catch { Alert.alert('Erro', 'Falha ao confirmar alarme.'); }
    };

    const atualizarStatus = async () => {
        try {
            const res = await getStatus(espIp);
            if (res.data) {
                // depending on esp response shape
                const hora = (res.data.hora || res.data.time || res.data.timeString || '').toString();
                setHoraAtual(hora || '--:--');
                setStatus('Conectado');
            }
        } catch { setStatus('Falha na conexão com o ESP'); setHoraAtual('--:--'); }
    };

    // estado para banner ativo
    const [activeAlarm, setActiveAlarm] = useState<any>(null);

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.topbar}>
                <View style={styles.tabGroup}>
                    <TouchableOpacity onPress={() => setTab('alarms')} style={[styles.tabBtn, tab === 'alarms' && styles.tabActive]}>
                        <Text style={[styles.tabText, tab === 'alarms' && styles.tabTextActive]}>Alarmes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setTab('alerts')} style={[styles.tabBtn, tab === 'alerts' && styles.tabActive]}>
                        <Text style={[styles.tabText, tab === 'alerts' && styles.tabTextActive]}>Alertas ({alerts.length})</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => navigation.navigate('Config')} style={styles.gearBtn}>
                    <Ionicons name="settings" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {activeAlarm && (
                <View style={styles.activeBanner}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>ALERTA: {activeAlarm.name} — LED {activeAlarm.led + 1}</Text>
                    <TouchableOpacity style={styles.confirmBtn} onPress={() => confirmarAlarmeAtivo(activeAlarm.id)}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Confirmar</Text>
                    </TouchableOpacity>
                </View>
            )}

            {tab === 'alarms' ? (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
                    <View style={{ alignItems: 'center' }}>
                        {/* path from src/screens -> ../../assets */}
                        <Image source={require('../../assets/images/logoTeste.png')} style={{ width: 250, height: 250, resizeMode: 'contain', marginTop: -50 }} />
                    </View>

                    <Text style={styles.title}>Alarme Medicinal</Text>
                    <Text style={styles.hora}>Hora atual: {horaAtual}</Text>

                    {alarms.map((alarm) => (
                        <View key={alarm.id} style={styles.alarmCard}>
                            <View style={styles.rowBetween}>
                                <View>
                                    <Text style={styles.alarmTitle}>{alarm.hour}:{alarm.minute}</Text>
                                    <Text style={styles.alarmName}>{alarm.name} — LED {alarm.led + 1}</Text>
                                </View>

                                <Switch value={alarm.enabled} onValueChange={() => alternarAlarme(alarm.id)} thumbColor={alarm.enabled ? '#41A579' : '#ccc'} trackColor={{ false: '#ccc', true: '#41A579' }} />
                            </View>

                            <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
                                <TouchableOpacity style={[styles.btn, styles.deleteBtn, { flex: 1 }]} onPress={() => excluirAlarme(alarm.id)}>
                                    <Text style={styles.deleteBtnText}>Excluir</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity style={[styles.btn, styles.addBtn]} onPress={abrirAlarmPicker}>
                        <Text style={styles.btnText}>Adicionar Alarme</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.btn, styles.clearBtn, { marginTop: 10 }]} onPress={async () => { await saveAlarms([]); }}>
                        <Text style={styles.btnText}>Limpar Memória</Text>
                    </TouchableOpacity>

                    <Text style={styles.status}>Status: {status}</Text>

                    <AlarmModal visible={showModal} tempHour={tempHour} tempMinute={tempMinute} tempName={tempName} tempLed={tempLed} activeField={activeField} onChangeName={setTempName} onSelectField={setActiveField} onAddNumber={adicionarNumero} onDelete={apagar} onSelectLed={setTempLed} onClose={() => setShowModal(false)} onConfirm={salvarNovoAlarme} />
                </ScrollView>
            ) : (
                <View style={{ flex: 1, backgroundColor: '#fff' }}>
                    <View style={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
                        <Text style={{ color: '#333' }}>Histórico de alertas</Text>
                        <TouchableOpacity onPress={async () => { await saveAlerts([]); }} style={styles.clearAlertsBtn}>
                            <Text style={styles.clearAlertsBtnText}>Limpar</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList data={alerts} keyExtractor={(it) => String(it.id)} contentContainerStyle={{ padding: 16 }} ListEmptyComponent={<Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>Sem alertas</Text>} renderItem={({ item }) => (
                        <View style={{ backgroundColor: '#f5f5f5', padding: 12, borderRadius: 10, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#41A579' }}>
                            <Text style={{ color: '#333', fontWeight: '700' }}>{item.title}</Text>
                            <Text style={{ color: '#666', marginTop: 6, fontSize: 12 }}>{new Date(item.timestamp).toLocaleString()}</Text>
                            <Text style={{ color: '#555', marginTop: 8 }}>{item.message}</Text>
                        </View>
                    )} />
                </View>
            )}
        </View>
    );
}


const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 16, backgroundColor: '#fff' },

    topbar: { flexDirection: 'row', backgroundColor: '#2C674D', paddingVertical: 10, borderBottomColor: '#ddd' }, // Fundo verde
        tabGroup: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
        tabBtn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 6, marginRight: 8 },
        tabActive: { backgroundColor: '#4cac82ff' },
        tabText: { color: '#fff', fontWeight: '600' },
        tabTextActive: { color: '#fff', fontWeight: '700' },
        gearBtn: { position: 'absolute', right: 10, top: 8, padding: 8 },

    activeBanner: {
        backgroundColor: '#D9534F',
        padding: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    confirmBtn: { backgroundColor: '#1e6443', padding: 8, borderRadius: 8 },

    title: { fontSize: 24, marginBottom: 8, fontWeight: '700', color: '#333', textAlign: 'center' },
    hora: { fontSize: 14, marginBottom: 20, color: '#666', textAlign: 'center' },

    alarmCard: { backgroundColor: '#F5F5F5', borderRadius: 16, padding: 20, marginBottom: 16, borderLeftWidth: 6, borderLeftColor: '#41A579', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 3 },

    alarmTitle: { fontSize: 24, fontWeight: '800', color: '#333' },
    alarmName: { color: '#666', fontSize: 14, marginTop: 4 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    addBtn: { backgroundColor: '#2C674D', marginTop: 10 },

    deleteBtn: { backgroundColor: '#dc3545', flex: 1 },
    deleteBtnText: { color: '#fff', fontWeight: '700' },

    clearBtn: { backgroundColor: '#dc3545' },

    status: { marginTop: 20, fontSize: 14, textAlign: 'center', color: '#888' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalBox: { backgroundColor: '#fff', padding: 24, borderRadius: 16, width: '90%', maxWidth: 400, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 10 },
    modalTitle: { color: '#333', fontSize: 20, fontWeight: '600', marginBottom: 16 },

    input: { width: '100%', backgroundColor: '#f5f5f5', color: '#333', borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 16, borderWidth: 1, borderColor: '#ddd' },

    modalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },

    displayText: { fontSize: 48, color: '#333', fontWeight: '800', width: 80, textAlign: 'center', paddingBottom: 5 },
    modalDots: { color: '#333', fontSize: 36, marginHorizontal: 5 },

    activeDisplay: { borderBottomWidth: 3, borderBottomColor: '#2C674D' },
    invalidDisplay: { color: '#dc3545' },

    keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginBottom: 20 },
    key: { backgroundColor: '#eee', width: '28%', margin: '2%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#ddd' },
    keyText: { color: '#333', fontSize: 28, fontWeight: '700' },

    deleteKey: { backgroundColor: '#6c757d', width: '28%', margin: '2%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
    deleteKeyText: { color: '#fff', fontSize: 28, fontWeight: '700' },

    modalButtons: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 10 },
    cancelBtn: { backgroundColor: '#6c757d' },
    cancelBtnText: { color: '#fff', fontWeight: '700' },

    ledButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 10 },
    dayBtn: { backgroundColor: '#e9ecef', padding: 8, borderRadius: 10, alignItems: 'center', flex: 1, marginHorizontal: 2, borderWidth: 1, borderColor: '#ddd' },
    ledActive: { backgroundColor: '#41A579' },
    dayBtnText: { color: '#333', fontWeight: '600' },

    clearAlertsBtn: { backgroundColor: '#dc3545', padding: 8, borderRadius: 8 },
    clearAlertsBtnText: { color: '#fff' },
});