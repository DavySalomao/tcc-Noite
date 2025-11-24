import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { configureWiFi } from '../services/esp';
import { useEspIp } from '../hooks/useEspIp';
import { Ionicons } from '@expo/vector-icons';

export default function ConfigScreen() {
    const [ssid, setSsid] = useState('');
    const [pass, setPass] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { espIp, setEspIp, resetToDefault } = useEspIp();

    const enviar = async () => {
        if (!ssid.trim()) {
            Alert.alert('Atenção', 'Por favor, informe o SSID da rede Wi-Fi');
            return;
        }
        
        try {
            const response = await configureWiFi(espIp, ssid, pass);
            
            // Se o ESP retornou um novo IP, salva automaticamente
            if (response.data?.success && response.data?.ip) {
                const newIp = response.data.ip;
                await setEspIp(newIp);
                
                Alert.alert(
                    '✅ Sucesso', 
                    `ESP configurado com sucesso!\n\n📍 Novo IP: ${newIp}\n\nO IP foi salvo automaticamente e já está disponível em todas as telas.`,
                    [{ text: 'OK' }]
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
                            <Text style={styles.infoTitle}>Instruções</Text>
                            <Text style={styles.infoText}>
                                1. Conecte seu celular à rede Wi-Fi "Medtime" (senha: 12345678){'\n'}
                                2. Preencha os campos abaixo{'\n'}
                                3. Toque em "Enviar Configuração"
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.card}>
                    <View style={styles.ipStatusContainer}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>
                                <Ionicons name="server" size={16} color="#666" /> IP do ESP
                            </Text>
                            <View style={styles.ipDisplayBox}>
                                <Ionicons name="radio-button-on" size={12} color="#28a745" />
                                <Text style={styles.ipDisplayText}>{espIp}</Text>
                            </View>
                            <Text style={styles.hint}>
                                {espIp === 'http://192.168.4.1' ? 'Modo AP (padrão)' : 'Conectado à rede WiFi'}
                            </Text>
                        </View>
                        {espIp !== 'http://192.168.4.1' && (
                            <TouchableOpacity 
                                style={styles.resetBtn} 
                                onPress={() => {
                                    Alert.alert(
                                        'Resetar IP',
                                        'Deseja voltar para o IP padrão (192.168.4.1)?',
                                        [
                                            { text: 'Cancelar', style: 'cancel' },
                                            { 
                                                text: 'Resetar', 
                                                style: 'destructive',
                                                onPress: resetToDefault
                                            }
                                        ]
                                    );
                                }}
                            >
                                <Ionicons name="refresh" size={20} color="#D9534F" />
                            </TouchableOpacity>
                        )}
                    </View>
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
                    <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Enviar Configuração</Text>
                </TouchableOpacity>

                <View style={styles.warningBox}>
                    <Ionicons name="warning" size={20} color="#f59e0b" />
                    <Text style={styles.warningText}>
                        Certifique-se de estar conectado à rede Wi-Fi "Medtime" do ESP antes de enviar.
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
    resetBtn: {
        backgroundColor: '#fee',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fcc',
    },
});