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
    const { espIp, setEspIp, resetToDefault, isConnected, testEspConnection, autoDiscoverEsp, discovering } = useEspIp();
    const [wifiMode, setWifiMode] = useState<'ap_mode' | 'connected' | 'unknown'>('unknown');
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [editingIp, setEditingIp] = useState(false);
    const [tempIp, setTempIp] = useState('');

    useEffect(() => {
        checkEspStatus();
        const interval = setInterval(checkEspStatus, 5000);
        return () => clearInterval(interval);
    }, [espIp]);

    useEffect(() => {
        setTempIp(espIp.replace('http://', '').replace('https://', ''));
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
        if (!ssid.trim()) {
            Alert.alert('Atenção', 'Por favor, informe o SSID da rede Wi-Fi');
            return;
        }
        
        try {
            const response = await configureWiFi(espIp, ssid, pass);
            
            if (response.data?.success && response.data?.ip) {
                const newIp = response.data.ip;
                
                await setEspIp(newIp);
                
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                Alert.alert(
                    '✅ Sucesso', 
                    `ESP configurado!\n\n🌐 Use: medtime.local (mDNS automático)\n📍 Ou IP: http://${newIp}\n\n⚠️ Importante: Conecte seu celular à rede "${ssid}" para usar o app.`,
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
                                'ESP resetado! Ele irá reiniciar em modo AP.\n\nReconecte na rede "MedTime" para configurar novamente.\n\nApós configurar, use medtime.local automaticamente.',
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

    const handleTestConnection = async () => {
        setTesting(true);
        try {
            const connected = await testEspConnection();
            if (connected) {
                Alert.alert(
                    '✅ Conexão OK!',
                    `O ESP está acessível em:\n${espIp}\n\nA comunicação está funcionando corretamente.`
                );
            } else {
                Alert.alert(
                    '❌ Sem Conexão',
                    `Não foi possível conectar ao ESP em:\n${espIp}\n\n🔍 Verificações:\n• Celular e ESP na mesma rede WiFi?\n• ESP está ligado?\n• Tente digitar o IP manualmente na tela de configuração`,
                    [
                        { text: 'OK', style: 'cancel' },
                        {
                            text: 'Ver Serial Monitor',
                            onPress: () => Alert.alert('Info', 'No Arduino IDE:\n1. Abra Tools > Serial Monitor\n2. Digite: STATUS\n3. Copie o IP mostrado')
                        }
                    ]
                );
            }
        } catch (e: any) {
            Alert.alert('❌ Erro', e?.message || 'Erro ao testar conexão');
        } finally {
            setTesting(false);
        }
    };

    const handleSaveIp = async () => {
        if (!tempIp.trim()) {
            Alert.alert('Atenção', 'Por favor, informe o IP ou hostname do ESP');
            return;
        }

        const formatted = tempIp.trim();
        await setEspIp(formatted);
        setEditingIp(false);
        
        const connected = await testEspConnection();
        if (connected) {
            Alert.alert(
                '✅ IP Salvo!',
                `Endereço atualizado para:\nhttp://${formatted}\n\nConexão testada com sucesso!`
            );
        } else {
            Alert.alert(
                '⚠️ IP Salvo',
                `Endereço salvo como:\nhttp://${formatted}\n\nMas não foi possível conectar.\n\nVerifique se o IP está correto e se o ESP está ligado.`
            );
        }
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
                                    '• O ESP está acessível em medtime.local (mDNS)\n• Funciona automaticamente na mesma rede WiFi!\n• Você pode reconfigurar abaixo se necessário'
                                ) : wifiMode === 'ap_mode' ? (
                                    '1. Conecte seu celular à rede "MedTime" (senha: 12345678)\n2. Preencha SSID e senha da sua rede WiFi\n3. Toque em "Enviar Configuração"\n4. Após conectar, use medtime.local'
                                ) : (
                                    '• O app usa medtime.local automaticamente\n• Certifique-se de estar na mesma rede WiFi do ESP\n• Ou digite o IP manualmente se necessário'
                                )}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={styles.label}>
                            <Ionicons name="server" size={16} color="#666" /> Endereço do ESP
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {!editingIp && !discovering && (
                                <TouchableOpacity onPress={autoDiscoverEsp}>
                                    <Ionicons name="search" size={20} color="#0066cc" />
                                </TouchableOpacity>
                            )}
                            {!editingIp && (
                                <TouchableOpacity onPress={() => setEditingIp(true)}>
                                    <Ionicons name="pencil" size={20} color="#2C674D" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    
                    {discovering && (
                        <View style={styles.discoveryBox}>
                            <ActivityIndicator size="small" color="#0066cc" />
                            <Text style={styles.discoveryText}>🔍 Procurando ESP na rede...</Text>
                        </View>
                    )}
                    
                    {editingIp ? (
                        <>
                            <View style={styles.inputContainer}>
                                <Ionicons name="globe-outline" size={20} color="#999" style={styles.inputIcon} />
                                <TextInput 
                                    style={styles.input} 
                                    value={tempIp} 
                                    onChangeText={setTempIp}
                                    placeholder="192.168.0.100 ou medtime.local"
                                    placeholderTextColor="#999"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                <TouchableOpacity 
                                    style={[styles.smallBtn, { backgroundColor: '#2C674D', flex: 1 }]} 
                                    onPress={handleSaveIp}
                                >
                                    <Ionicons name="checkmark" size={18} color="#fff" />
                                    <Text style={styles.smallBtnText}>Salvar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.smallBtn, { backgroundColor: '#999', flex: 1 }]} 
                                    onPress={() => {
                                        setEditingIp(false);
                                        setTempIp(espIp.replace('http://', '').replace('https://', ''));
                                    }}
                                >
                                    <Ionicons name="close" size={18} color="#fff" />
                                    <Text style={styles.smallBtnText}>Cancelar</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={[styles.inputContainer, styles.disabledInput]}>
                                <Ionicons 
                                    name={isConnected ? "checkmark-circle" : "close-circle"} 
                                    size={20} 
                                    color={isConnected ? "#2C674D" : "#dc3545"} 
                                    style={styles.inputIcon} 
                                />
                                <TextInput 
                                    style={[styles.input, styles.fixedIpText]} 
                                    value={espIp.replace('http://', '').replace('https://', '')}
                                    editable={false}
                                    selectTextOnFocus={false}
                                />
                            </View>
                            <Text style={[styles.hint, !isConnected && styles.errorHint]}>
                                {isConnected 
                                    ? '✅ ESP conectado e funcionando!'
                                    : '⚠️ ESP não encontrado - Toque na lupa 🔍 para buscar ou no lápis ✏️ para editar'
                                }
                            </Text>
                        </>
                    )}
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
    disabledInput: {
        backgroundColor: '#f0f0f0',
        borderColor: '#d0d0d0',
    },
    fixedIpText: {
        color: '#2C674D',
        fontWeight: '700',
        fontSize: 16,
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
    errorHint: {
        color: '#dc3545',
        fontWeight: '600',
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
    testBtn: {
        backgroundColor: '#0066cc',
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
    testBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 17,
    },
    smallBtn: {
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    smallBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    discoveryBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e3f2fd',
        padding: 16,
        borderRadius: 12,
        gap: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#0066cc',
    },
    discoveryText: {
        fontSize: 14,
        color: '#0066cc',
        fontWeight: '600',
    },
});