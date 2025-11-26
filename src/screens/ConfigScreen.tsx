import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { configureWiFi, getStatus, resetEsp } from '../services/esp';
import { useEspIp } from '../hooks/useEspIp';
import { Ionicons } from '@expo/vector-icons';

export default function ConfigScreen() {
    const [ssid, setSsid] = useState('');
    const [pass, setPass] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { espIp, setEspIp, resetToDefault } = useEspIp();
    const [tempIp, setTempIp] = useState(''); // IP editável local
    const [wifiMode, setWifiMode] = useState<'ap_mode' | 'connected' | 'unknown'>('unknown');
    const [loading, setLoading] = useState(false); // Começa sem loading

    useEffect(() => {
        checkEspStatus();
        const interval = setInterval(checkEspStatus, 5000); // Aumentado para 5s
        return () => clearInterval(interval);
    }, [espIp]);

    // Sincroniza IP local com o global
    useEffect(() => {
        setTempIp(espIp.replace('http://', ''));
    }, [espIp]);

    const checkEspStatus = async () => {
        try {
            const response = await getStatus(espIp);
            if (response.data?.wifi) {
                setWifiMode(response.data.wifi);
                setLoading(false);
            }
        } catch (err) {
            setWifiMode('unknown');
            setLoading(false); // Remove loading mesmo com erro
        }
    };

    const enviar = async () => {
        // Atualiza o IP se foi modificado
        if (tempIp.trim() && tempIp !== espIp.replace('http://', '')) {
            await setEspIp(tempIp.trim());
            Alert.alert(
                '✅ IP Atualizado', 
                `Novo IP salvo: http://${tempIp.trim()}\n\n⚠️ Importante:\n• Certifique-se de estar na mesma rede WiFi do ESP\n• Use o botão "Testar Conexão" para verificar`
            );
            return;
        }

        // Se não modificou IP, continua com configuração WiFi
        if (!ssid.trim()) {
            Alert.alert('Atenção', 'Por favor, informe o SSID da rede Wi-Fi ou atualize o IP');
            return;
        }
        
        try {
            const response = await configureWiFi(espIp, ssid, pass);
            
            // Se o ESP retornou um novo IP, salva automaticamente
            if (response.data?.success && response.data?.ip) {
                const newIp = response.data.ip; // ESP já retorna apenas o IP (ex: 192.168.0.2)
                
                // Salva o novo IP imediatamente
                await setEspIp(newIp); // Hook adiciona http:// automaticamente
                
                // Aguarda 3 segundos para o ESP reiniciar
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                Alert.alert(
                    '✅ Sucesso', 
                    `ESP configurado!\n\n📍 Novo IP: http://${newIp}\n\n⚠️ Importante: Conecte seu celular à rede "${ssid}" para usar o app.`,
                    [{ text: 'Entendi' }]
                );
            } else {
                Alert.alert('✅ Sucesso', 'Credenciais enviadas ao ESP.\n\nAguarde o ESP reiniciar e conectar à rede.');
            }
            
            setSsid('');
            setPass('');
        } catch (e: any) {
            Alert.alert('❌ Erro', e?.message || 'Falha ao enviar credenciais');
        }
    };

    const handleResetEsp = async () => {
        Alert.alert(
            '⚠️ Resetar ESP',
            'Isso irá limpar todas as credenciais WiFi salvas e o ESP voltará ao modo AP.\n\nTem certeza?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Resetar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await resetEsp(espIp);
                            Alert.alert(
                                '✅ Sucesso',
                                'ESP resetado! Ele irá reiniciar em modo AP.\n\nReconecte na rede "Medtime" para configurar novamente.',
                                [{ text: 'OK', onPress: resetToDefault }]
                            );
                        } catch (e: any) {
                            Alert.alert('❌ Erro', e?.message || 'Falha ao resetar ESP');
                        }
                    }
                }
            ]
        );
    };


    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#2C674D' }}>
            <ScrollView style={{ flex: 1, backgroundColor: '#f8f9fa' }} contentContainerStyle={styles.container}>
                <View style={styles.header}>
                    <Ionicons name="wifi" size={64} color="#2C674D" />
                    <Text style={styles.headerTitle}>Configurar Wi-Fi</Text>
                    <Text style={styles.headerSubtitle}>Configure a conexão do seu dispositivo ESP</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle" size={24} color="#0066cc" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.infoTitle}>
                                {wifiMode === 'connected' ? '✅ ESP Conectado' : '📋 Instruções de Uso'}
                            </Text>
                            <Text style={styles.infoText}>
                                {wifiMode === 'connected' ? (
                                    '• O ESP já está conectado à sua rede WiFi!\n• Você pode reconfigurar a rede abaixo se necessário'
                                ) : wifiMode === 'ap_mode' ? (
                                    '1. Conecte seu celular à rede "Medtime" (senha: 12345678)\n2. Preencha SSID e senha da sua rede WiFi\n3. Toque em "Enviar Configuração"'
                                ) : (
                                    '• Atualize o IP do ESP abaixo\n• Ou configure via rede "Medtime" se o ESP estiver em modo AP'
                                )}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>
                        <Ionicons name="server" size={16} color="#666" /> IP do ESP
                    </Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="globe-outline" size={20} color="#999" style={styles.inputIcon} />
                        <TextInput 
                            style={styles.input} 
                            value={tempIp} 
                            onChangeText={setTempIp}
                            placeholder="Ex: 192.168.0.2"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            autoCapitalize="none"
                        />
                    </View>
                    <Text style={styles.hint}>
                        {wifiMode === 'connected' 
                            ? '✅ ESP conectado à rede WiFi' 
                            : wifiMode === 'ap_mode'
                            ? '📡 Modo AP - IP padrão: 192.168.4.1'
                            : 'Digite o IP que aparece no Serial Monitor do Arduino'}
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>
                        <Ionicons name="wifi" size={16} color="#666" /> Nome da Rede (SSID)
                    </Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="wifi-outline" size={20} color="#999" style={styles.inputIcon} />
                        <TextInput 
                            style={styles.input} 
                            value={ssid} 
                            onChangeText={setSsid}
                            placeholder="Digite o nome da sua rede Wi-Fi"
                            placeholderTextColor="#999"
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>
                        <Ionicons name="lock-closed" size={16} color="#666" /> Senha da Rede
                    </Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="key" size={20} color="#999" style={styles.inputIcon} />
                        <TextInput 
                            style={[styles.input, { flex: 1 }]} 
                            value={pass} 
                            onChangeText={setPass}
                            placeholder="Digite a senha da rede Wi-Fi"
                            placeholderTextColor="#999"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                            <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity style={styles.btn} onPress={enviar}>
                    <Ionicons name="save" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Salvar Configurações</Text>
                </TouchableOpacity>

                {wifiMode === 'connected' && (
                    <TouchableOpacity style={styles.resetEspBtn} onPress={handleResetEsp}>
                        <Ionicons name="trash" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.resetEspBtnText}>Resetar ESP (Limpar WiFi)</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.warningBox}>
                    <Ionicons name="warning" size={20} color="#f59e0b" />
                    <Text style={styles.warningText}>
                        {wifiMode === 'ap_mode' 
                            ? 'Certifique-se de estar conectado à rede Wi-Fi "Medtime" do ESP antes de enviar.'
                            : wifiMode === 'connected'
                            ? 'Ao reconfigurar, o ESP irá reiniciar e conectar na nova rede WiFi.'
                            : 'Verifique se o ESP está ligado e acessível na rede.'}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: { 
        flexGrow: 1,
        padding: 16,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: '#fff',
        borderRadius: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#2C674D',
        marginTop: 16,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#e3f2fd',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#0066cc',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0066cc',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 13,
        color: '#444',
        lineHeight: 20,
    },
    quickTipBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff3cd',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#ff9800',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    quickTipTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ff6f00',
        marginBottom: 4,
    },
    quickTipText: {
        fontSize: 13,
        color: '#663c00',
        lineHeight: 18,
    },
    label: { 
        fontWeight: '700', 
        marginBottom: 12,
        fontSize: 15,
        color: '#333',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e0e0e0',
        borderRadius: 12,
        backgroundColor: '#f8f9fa',
    },
    inputIcon: {
        marginLeft: 12,
    },
    input: { 
        flex: 1,
        padding: 14,
        fontSize: 15,
        color: '#333',
    },
    eyeBtn: {
        padding: 12,
    },
    hint: {
        fontSize: 12,
        color: '#999',
        marginTop: 8,
        fontStyle: 'italic',
    },
    btn: { 
        backgroundColor: '#2C674D', 
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 8,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    btnText: { 
        color: '#fff', 
        fontWeight: '700',
        fontSize: 17,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        padding: 16,
        borderRadius: 12,
        gap: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#f59e0b',
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        color: '#92400e',
        lineHeight: 18,
    },
    ipStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    ipDisplayBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f5e9',
        padding: 12,
        borderRadius: 8,
        gap: 8,
        marginTop: 8,
    },
    ipDisplayText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2C674D',
    },
    editIpBtn: {
        backgroundColor: '#e3f2fd',
        padding: 14,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#2196f3',
        shadowColor: '#2196f3',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    resetBtn: {
        backgroundColor: '#fee',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fcc',
    },
    resetEspBtn: {
        backgroundColor: '#dc3545',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 8,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    resetEspBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 17,
    },
});