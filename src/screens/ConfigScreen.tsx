import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { configureWiFi } from '../services/esp';


export default function ConfigScreen() {
    const [ssid, setSsid] = useState('');
    const [pass, setPass] = useState('');
    const [espIp, setEspIp] = useState('http://192.168.4.1');


    const enviar = async () => {
        try {
            await configureWiFi(espIp, ssid, pass);
            Alert.alert('Feito', 'Credenciais enviadas. Verifique se o ESP reiniciou e conectou à rede.');
        } catch (e: any) {
            Alert.alert('Erro', e?.message || 'Falha ao enviar');
        }
    };


    return (
        <View style={styles.box}>
            <Text style={styles.label}>IP do ESP (modo AP: 192.168.4.1)</Text>
            <TextInput style={styles.input} value={espIp} onChangeText={setEspIp} />


            <Text style={styles.label}>SSID</Text>
            <TextInput style={styles.input} value={ssid} onChangeText={setSsid} />


            <Text style={styles.label}>Senha</Text>
            <TextInput style={styles.input} value={pass} onChangeText={setPass} secureTextEntry />


            <TouchableOpacity style={styles.btn} onPress={enviar}>
                <Text style={styles.btnText}>Enviar ao ESP</Text>
            </TouchableOpacity>


            <Text style={{ marginTop: 10, color: '#666' }}>Obs: conecte seu celular à rede do ESP (Medtime) antes de enviar.</Text>
        </View>
    );
}


const styles = StyleSheet.create({
    box: { padding: 16 },
    label: { fontWeight: '700', marginTop: 12 },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 6, borderRadius: 8 },
    btn: { backgroundColor: '#2C674D', padding: 12, marginTop: 16, borderRadius: 10, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700' }
});