import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, StyleSheet, Switch, Image, ScrollView, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AlarmModal from '../components/AlarmModal';
import { listAlarms, setAlarm, deleteAlarm, getStatus, getActive, stopAlarm } from '../services/esp';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type AlarmType = { id: number; hour: string; minute: string; name: string; led: number; enabled: boolean };
type AlertItem = { id: number; timestamp: number; title: string; message: string };

export default function AlarmsScreen({ navigation }: any) {
    const [alarms, setAlarms] = useState<AlarmType[]>([]);
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [espIp, setEspIp] = useState('http://192.168.0.5');
    const [showEspModal, setShowEspModal] = useState(false);

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
    const [remainingMs, setRemainingMs] = useState<number | null>(null);

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
        
        // Atualiza hora do dispositivo a cada segundo (sem requisição HTTP)
        const horaInterval = setInterval(() => {
            const now = new Date();
            const h = now.getHours().toString().padStart(2, '0');
            const m = now.getMinutes().toString().padStart(2, '0');
            setHoraAtual(`${h}:${m}`);
        }, 1000);
        
        // Verifica status do ESP a cada 2 segundos
        const statusInterval = setInterval(() => { pollActive(); atualizarStatus(); }, 2000);
        
        return () => {
            clearInterval(horaInterval);
            clearInterval(statusInterval);
        };
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
            const saved = await AsyncStorage.getItem('espIp');
            if (saved) setEspIp(saved);
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

    const saveEspIp = async (value?: string) => {
        try {
            const v = value ?? espIp;
            await AsyncStorage.setItem('espIp', v);
            setEspIp(v);
            setShowEspModal(false);
            Alert.alert('Salvo', `IP salvo: ${v}`);
        } catch (e) { console.warn('saveEspIp', e); Alert.alert('Erro', 'Não foi possível salvar o IP'); }
    };

    const testEspConnection = async (ip?: string) => {
        const base = ip ?? espIp;
        try {
            const res = await getActive(base);
            Alert.alert('Resposta', JSON.stringify(res.data));
        } catch (err: any) {
            console.warn('testEspConnection failed', err);
            Alert.alert('Erro de conexão', err?.message || String(err));
        }
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
                // sempre atualiza o estado do alarme ativo para garantir que o modal apareça
                // if the ESP reports the alarm already acknowledged, clear local state
                if (res.data.acknowledged) {
                    activeFetchedRef.current = null;
                    setActiveAlarm(null);
                    await pushAlert('Alarme já confirmado', `Alarme ${res.data.name} já confirmado no dispositivo.`);
                } else {
                    setActiveAlarm(res.data);
                }

                if (activeFetchedRef.current !== res.data.id) {
                    activeFetchedRef.current = res.data.id;
                    const msg = `Hora do remédio "${res.data.name}", LED ${res.data.led + 1}.`;
                    await pushAlert('Alerta de remédio', msg);
                    try {
                        // Notificações locais funcionam no Expo Go
                        await Notifications.scheduleNotificationAsync({ 
                            content: { 
                                title: '💊 Hora do Remédio!', 
                                body: msg, 
                                sound: 'default',
                                priority: Notifications.AndroidNotificationPriority.HIGH,
                            }, 
                            trigger: null 
                        });
                    } catch (e) { 
                        // Silencioso: notificações podem falhar no Expo Go
                    }
                }
                // Se conseguiu conectar, atualiza status
                if (status !== 'Conectado') {
                    setStatus('Conectado');
                }
            } else {
                activeFetchedRef.current = null;
                setActiveAlarm(null);
                if (status !== 'Conectado') {
                    setStatus('Conectado');
                }
            }
        } catch (err) {
            // Silencioso: não loga warnings quando ESP não está conectado
            // Apenas atualiza o status se ainda não foi atualizado
            if (status === 'Desconhecido' || status === 'Conectado') {
                setStatus('ESP desconectado');
            }
        }
    };

    

    const confirmarAlarmeAtivo = async (id?: number) => {
        try {
            const res = await stopAlarm(espIp, id);
            // expect JSON { ok: true, acknowledged: true }
            if (res?.data && (res.data.ok || res.status === 200)) {
                const ack = res.data.acknowledged ?? true;
                if (ack) {
                    setActiveAlarm(null);
                    activeFetchedRef.current = null;
                    await pushAlert('Alarme confirmado', `Confirmado`);
                    Alert.alert('Confirmado', 'Alarme interrompido.');
                } else {
                    // fallback: if ESP didn't explicitly ack, still clear
                    setActiveAlarm(null);
                    activeFetchedRef.current = null;
                    await pushAlert('Alarme confirmado', `Confirmado`);
                    Alert.alert('Confirmado', 'Alarme interrompido.');
                }
            } else {
                throw new Error('Resposta inválida do ESP');
            }
        } catch (err) {
            console.warn('confirmarAlarmeAtivo failed', err);
            Alert.alert('Erro', 'Falha ao confirmar alarme.');
        }
    };

    const atualizarStatus = async () => {
        try {
            const res = await getStatus(espIp);
            if (res.data) {
                // Atualiza apenas o status WiFi (hora vem do dispositivo)
                setStatus('Conectado');
            }
        } catch { 
            // Silencioso: não atualiza status se já foi definido por pollActive
            if (status !== 'ESP desconectado') {
                // Hora continua sendo atualizada pelo timer local
            }
        }
    };

    // estado para banner ativo
    const [activeAlarm, setActiveAlarm] = useState<any>(null);

    // atualizar contador local de tempo restante para mostrar no modal
    useEffect(() => {
        if (activeAlarm?.remainingMs != null) {
            setRemainingMs(Number(activeAlarm.remainingMs));
            const timer = setInterval(() => {
                setRemainingMs((m) => (m != null ? Math.max(0, m - 1000) : m));
            }, 1000);
            return () => clearInterval(timer);
        } else {
            setRemainingMs(null);
        }
    }, [activeAlarm]);

    const formatMs = (ms: number | null) => {
        if (ms == null) return '--:--';
        const total = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(total / 60).toString().padStart(2, '0');
        const seconds = (total % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#2C674D' }}>
            <View style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
            {/* Modal full-screen que aparece enquanto o alarme está ativo. Botão Confirmar interrompe o alarme no ESP */}
            <Modal visible={!!activeAlarm} transparent animationType="fade">
                <View style={styles.activeModalOverlay}>
                    <View style={styles.activeModalBox}>
                        <MaterialCommunityIcons name="pill" size={64} color="#D9534F" style={{ marginBottom: 16 }} />
                        <Text style={styles.activeModalTitle}>⏰ Hora do Remédio!</Text>
                        <Text style={styles.activeModalText}>{activeAlarm?.name}</Text>
                        <View style={styles.ledBadge}>
                            <MaterialCommunityIcons name="led-on" size={20} color="#fff" />
                            <Text style={styles.ledBadgeText}>LED {activeAlarm?.led + 1}</Text>
                        </View>

                        <Text style={styles.activeModalTimer}>⏱ {formatMs(remainingMs)}</Text>

                        <TouchableOpacity style={styles.activeModalConfirm} onPress={() => confirmarAlarmeAtivo(activeAlarm?.id)}>
                            <Ionicons name="checkmark-circle" size={24} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>Confirmar Medicação</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <View style={styles.topbar}>
                <View style={styles.tabGroup}>
                    <TouchableOpacity onPress={() => setTab('alarms')} style={[styles.tabBtn, tab === 'alarms' && styles.tabActive]}>
                        <Ionicons name="alarm" size={18} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={[styles.tabText, tab === 'alarms' && styles.tabTextActive]}>Alarmes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setTab('alerts')} style={[styles.tabBtn, tab === 'alerts' && styles.tabActive]}>
                        <Ionicons name="notifications" size={18} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={[styles.tabText, tab === 'alerts' && styles.tabTextActive]}>Alertas ({alerts.length})</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => navigation.navigate('Config')} style={styles.gearBtn}>
                    <Ionicons name="settings" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {activeAlarm && (
                <View style={styles.activeBanner}>
                    <MaterialCommunityIcons name="bell-ring" size={24} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#fff', fontWeight: '700', flex: 1 }}>ALERTA: {activeAlarm.name}</Text>
                    <TouchableOpacity style={styles.confirmBtn} onPress={() => confirmarAlarmeAtivo(activeAlarm.id)}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Confirmar</Text>
                    </TouchableOpacity>
                </View>
            )}

            {tab === 'alarms' ? (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
                    <View style={styles.headerCard}>
                        <View style={{ alignItems: 'center' }}>
                            <Image source={require('../../assets/images/logoTeste.png')} style={{ width: 275, height: 275, resizeMode: 'contain' }} />
                        </View>

                        <Text style={styles.subtitle}>Seu assistente de medicação</Text>
                        
                        <View style={styles.statusCard}>
                            <View style={styles.statusRow}>
                                <Ionicons name="time" size={20} color="#2C674D" />
                                <Text style={styles.statusLabel}>Hora atual:</Text>
                                <Text style={styles.statusValue}>{horaAtual}</Text>
                            </View>
                            <View style={styles.statusRow}>
                                <Ionicons name={status === 'Conectado' ? 'wifi' : 'wifi-outline'} size={20} color={status === 'Conectado' ? '#28a745' : '#dc3545'} />
                                <Text style={styles.statusLabel}>Status:</Text>
                                <Text style={[styles.statusValue, { color: status === 'Conectado' ? '#28a745' : '#dc3545' }]}>{status}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="pill" size={24} color="#2C674D" />
                        <Text style={styles.sectionTitle}>Meus Alarmes</Text>
                    </View>

                    {alarms.length === 0 && (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="alarm-off" size={64} color="#ccc" />
                            <Text style={styles.emptyText}>Nenhum alarme configurado</Text>
                            <Text style={styles.emptySubtext}>Adicione um alarme para começar</Text>
                        </View>
                    )}

                    {alarms.map((alarm) => (
                        <View key={alarm.id} style={styles.alarmCard}>
                            <View style={styles.alarmHeader}>
                                <View style={styles.alarmTimeContainer}>
                                    <Text style={styles.alarmTime}>{alarm.hour}:{alarm.minute}</Text>
                                    <View style={styles.alarmInfo}>
                                        <MaterialCommunityIcons name="pill" size={16} color="#666" />
                                        <Text style={styles.alarmName}>{alarm.name}</Text>
                                    </View>
                                </View>

                                <Switch 
                                    value={alarm.enabled} 
                                    onValueChange={() => alternarAlarme(alarm.id)} 
                                    thumbColor={alarm.enabled ? '#fff' : '#f4f3f4'}
                                    trackColor={{ false: '#d1d5db', true: '#41A579' }} 
                                    ios_backgroundColor="#d1d5db"
                                />
                            </View>

                            <View style={styles.ledIndicator}>
                                <MaterialCommunityIcons name="led-on" size={16} color="#41A579" />
                                <Text style={styles.ledText}>LED {alarm.led + 1}</Text>
                            </View>

                            <TouchableOpacity style={styles.deleteBtn} onPress={() => excluirAlarme(alarm.id)}>
                                <Ionicons name="trash" size={18} color="#fff" />
                                <Text style={styles.deleteBtnText}>Excluir</Text>
                            </TouchableOpacity>
                        </View>
                    ))}

                    <TouchableOpacity style={styles.addBtn} onPress={abrirAlarmPicker}>
                        <Ionicons name="add-circle" size={24} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.addBtnText}>Adicionar Alarme</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.clearBtn} onPress={async () => { 
                        Alert.alert('Confirmar', 'Deseja limpar todos os alarmes?', [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Limpar', onPress: async () => await saveAlarms([]), style: 'destructive' }
                        ]);
                    }}>
                        <Ionicons name="trash-bin" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.clearBtnText}>Limpar Todos os Alarmes</Text>
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />

                    <AlarmModal visible={showModal} tempHour={tempHour} tempMinute={tempMinute} tempName={tempName} tempLed={tempLed} activeField={activeField} onChangeName={setTempName} onSelectField={setActiveField} onAddNumber={adicionarNumero} onDelete={apagar} onSelectLed={setTempLed} onClose={() => setShowModal(false)} onConfirm={salvarNovoAlarme} />
                </ScrollView>
            ) : (
                <View style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
                    <View style={styles.alertsHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="time-outline" size={24} color="#333" style={{ marginRight: 8 }} />
                            <Text style={styles.alertsHeaderText}>Histórico de Alertas</Text>
                        </View>
                        <TouchableOpacity onPress={async () => { 
                            Alert.alert('Confirmar', 'Deseja limpar o histórico?', [
                                { text: 'Cancelar', style: 'cancel' },
                                { text: 'Limpar', onPress: async () => await saveAlerts([]), style: 'destructive' }
                            ]);
                        }} style={styles.clearAlertsBtn}>
                            <Ionicons name="trash" size={18} color="#fff" />
                            <Text style={styles.clearAlertsBtnText}>Limpar</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList data={alerts} keyExtractor={(it) => String(it.id)} contentContainerStyle={{ padding: 16 }} ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
                            <Text style={styles.emptyText}>Nenhum alerta</Text>
                            <Text style={styles.emptySubtext}>Os alertas aparecerão aqui</Text>
                        </View>
                    } renderItem={({ item }) => (
                        <View style={styles.alertCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Ionicons name="notifications" size={20} color="#2C674D" style={{ marginRight: 8 }} />
                                <Text style={styles.alertTitle}>{item.title}</Text>
                            </View>
                            <Text style={styles.alertTime}>{new Date(item.timestamp).toLocaleString('pt-BR')}</Text>
                            <Text style={styles.alertMessage}>{item.message}</Text>
                        </View>
                    )} />
                </View>
            )}
            </View>
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 16, backgroundColor: '#f8f9fa' },

    topbar: { 
        flexDirection: 'row', 
        backgroundColor: '#2C674D', 
        paddingVertical: 12,
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    tabGroup: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8, flex: 1 },
    tabBtn: { 
        paddingVertical: 10, 
        paddingHorizontal: 16, 
        borderRadius: 20, 
        marginRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabActive: { backgroundColor: '#41A579' },
    tabText: { color: '#e0e0e0', fontWeight: '600', fontSize: 14 },
    tabTextActive: { color: '#fff', fontWeight: '700' },
    gearBtn: { padding: 8 },

    activeBanner: {
        backgroundColor: '#D9534F',
        padding: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    confirmBtn: { 
        backgroundColor: '#1e6443', 
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },

    headerCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },

    title: { 
        fontSize: 32, 
        marginTop: 12,
        marginBottom: 4,
        fontWeight: '800', 
        color: '#2C674D', 
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    },

    statusCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    statusValue: {
        fontSize: 16,
        color: '#2C674D',
        fontWeight: '700',
        flex: 1,
        textAlign: 'right',
    },

    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#2C674D',
    },

    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#999',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#bbb',
        marginTop: 4,
    },

    alarmCard: { 
        backgroundColor: '#fff', 
        borderRadius: 20, 
        padding: 20, 
        marginBottom: 16, 
        borderLeftWidth: 6, 
        borderLeftColor: '#41A579', 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.08, 
        shadowRadius: 8, 
        elevation: 3,
    },

    alarmHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    alarmTimeContainer: {
        flex: 1,
    },
    alarmTime: { 
        fontSize: 36, 
        fontWeight: '800', 
        color: '#2C674D',
        letterSpacing: 2,
    },
    alarmInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    alarmName: { 
        color: '#666', 
        fontSize: 16, 
        fontWeight: '500',
    },

    ledIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f5e9',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 12,
        gap: 4,
    },
    ledText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2C674D',
    },

    deleteBtn: { 
        backgroundColor: '#dc3545', 
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    deleteBtnText: { 
        color: '#fff', 
        fontWeight: '700',
        fontSize: 15,
    },

    addBtn: { 
        backgroundColor: '#2C674D', 
        paddingVertical: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    addBtnText: { 
        color: '#fff', 
        fontWeight: '700', 
        fontSize: 18,
    },

    clearBtn: { 
        backgroundColor: '#6c757d',
        paddingVertical: 14,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    clearBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },

    alertsHeader: {
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    alertsHeaderText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },

    alertCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#2C674D',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    alertTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
        flex: 1,
    },
    alertTime: {
        fontSize: 12,
        color: '#999',
        marginBottom: 8,
    },
    alertMessage: {
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
    },

    clearAlertsBtn: { 
        backgroundColor: '#dc3545', 
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    clearAlertsBtnText: { 
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    
    /* Styles for active alarm fullscreen modal */
    activeModalOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.8)', 
        justifyContent: 'center', 
        alignItems: 'center',
    },
    activeModalBox: { 
        backgroundColor: '#fff', 
        width: '90%', 
        maxWidth: 420, 
        padding: 32, 
        borderRadius: 24, 
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 20,
    },
    activeModalTitle: { 
        fontSize: 28, 
        fontWeight: '800', 
        color: '#D9534F', 
        marginBottom: 12,
        textAlign: 'center',
    },
    activeModalText: { 
        fontSize: 20, 
        color: '#333', 
        marginBottom: 16, 
        textAlign: 'center',
        fontWeight: '600',
    },
    ledBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D9534F',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 16,
        gap: 6,
    },
    ledBadgeText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    activeModalTimer: { 
        fontSize: 48, 
        fontWeight: '800', 
        color: '#2C674D', 
        marginBottom: 24,
        letterSpacing: 4,
    },
    activeModalConfirm: { 
        backgroundColor: '#28a745', 
        paddingVertical: 16, 
        paddingHorizontal: 32, 
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
});