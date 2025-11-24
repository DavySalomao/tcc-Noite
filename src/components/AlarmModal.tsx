import React from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ScrollView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
    visible: boolean;
    tempHour: string;
    tempMinute: string;
    tempName: string;
    tempLed: number;
    activeField: "hour" | "minute";

    onChangeName: (t: string) => void;
    onSelectField: (f: "hour" | "minute") => void;

    onAddNumber: (n: string) => void;
    onDelete: () => void;

    onSelectLed: (n: number) => void;

    onClose: () => void;
    onConfirm: () => void;
};

export default function AlarmModal({
    visible,
    tempHour,
    tempMinute,
    tempName,
    tempLed,
    activeField,

    onChangeName,
    onSelectField,

    onAddNumber,
    onDelete,

    onSelectLed,

    onClose,
    onConfirm,
}: Props) {
    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.box}>
                    <View style={styles.header}>
                        <MaterialCommunityIcons name="alarm-plus" size={32} color="#2C674D" />
                        <Text style={styles.title}>Novo Alarme</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close-circle" size={28} color="#999" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>
                                <MaterialCommunityIcons name="pill" size={16} color="#666" /> Nome do Medicamento
                            </Text>
                            <View style={styles.inputContainer}>
                                <Ionicons name="create-outline" size={20} color="#999" style={{ marginLeft: 12 }} />
                                <TextInput
                                    placeholder="Ex: Losartana, Omeprazol..."
                                    placeholderTextColor="#999"
                                    style={styles.input}
                                    value={tempName}
                                    onChangeText={onChangeName}
                                />
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>
                                <Ionicons name="time" size={16} color="#666" /> Horário
                            </Text>
                            <View style={styles.timeDisplay}>
                                <TouchableOpacity 
                                    onPress={() => onSelectField("hour")}
                                    style={[styles.timeBox, activeField === "hour" && styles.timeBoxActive]}
                                >
                                    <Text
                                        style={[
                                            styles.timeText,
                                            activeField === "hour" && styles.timeTextActive,
                                            (parseInt(tempHour) > 23 || tempHour.length === 0) && styles.timeTextInvalid,
                                        ]}
                                    >
                                        {tempHour.padStart(2, "0") || "--"}
                                    </Text>
                                    <Text style={styles.timeLabel}>Hora</Text>
                                </TouchableOpacity>

                                <Text style={styles.timeSeparator}>:</Text>

                                <TouchableOpacity 
                                    onPress={() => onSelectField("minute")}
                                    style={[styles.timeBox, activeField === "minute" && styles.timeBoxActive]}
                                >
                                    <Text
                                        style={[
                                            styles.timeText,
                                            activeField === "minute" && styles.timeTextActive,
                                            (parseInt(tempMinute) > 59 || tempMinute.length === 0) && styles.timeTextInvalid,
                                        ]}
                                    >
                                        {tempMinute.padStart(2, "0") || "--"}
                                    </Text>
                                    <Text style={styles.timeLabel}>Min</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>
                                <MaterialCommunityIcons name="led-on" size={16} color="#666" /> Selecione o LED
                            </Text>
                            <View style={styles.ledGrid}>
                                {[0, 1, 2, 3, 4, 5, 6, 7].map((led) => (
                                    <TouchableOpacity
                                        key={led}
                                        style={[styles.ledBtn, tempLed === led && styles.ledBtnActive]}
                                        onPress={() => onSelectLed(led)}
                                    >
                                        <MaterialCommunityIcons 
                                            name="led-on" 
                                            size={20} 
                                            color={tempLed === led ? "#fff" : "#41A579"} 
                                        />
                                        <Text style={[styles.ledText, tempLed === led && styles.ledTextActive]}>
                                            LED {led + 1}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>
                                <Ionicons name="keypad" size={16} color="#666" /> Digite o horário
                            </Text>
                            <View style={styles.keypad}>
                                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((n) => (
                                    <TouchableOpacity
                                        key={n}
                                        style={styles.key}
                                        onPress={() => onAddNumber(n)}
                                    >
                                        <Text style={styles.keyText}>{n}</Text>
                                    </TouchableOpacity>
                                ))}

                                <TouchableOpacity style={styles.delKey} onPress={onDelete}>
                                    <Ionicons name="backspace" size={28} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.btnRow}>
                        <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
                            <Ionicons name="close" size={20} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.btnCancelText}>Cancelar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.btn, styles.confirmBtn]} onPress={onConfirm}>
                            <Ionicons name="checkmark" size={20} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.btnConfirmText}>Salvar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "flex-end",
    },
    box: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    title: { 
        fontSize: 24, 
        fontWeight: "700", 
        color: "#2C674D",
        marginLeft: 12,
        flex: 1,
    },
    closeBtn: {
        padding: 4,
    },
    section: {
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    sectionLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#333',
        marginBottom: 12,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: "#f8f9fa",
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e0e0e0',
        marginBottom: 8,
    },
    input: {
        flex: 1,
        color: "#333",
        padding: 14,
        fontSize: 16,
    },
    timeDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        gap: 16,
    },
    timeBox: {
        backgroundColor: '#f8f9fa',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        minWidth: 100,
        borderWidth: 3,
        borderColor: '#e0e0e0',
    },
    timeBoxActive: {
        borderColor: '#2C674D',
        backgroundColor: '#e8f5e9',
    },
    timeText: {
        fontSize: 48,
        fontWeight: '800',
        color: '#333',
        letterSpacing: 4,
    },
    timeTextActive: {
        color: '#2C674D',
    },
    timeTextInvalid: {
        color: '#dc3545',
    },
    timeLabel: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
        fontWeight: '600',
    },
    timeSeparator: {
        fontSize: 48,
        fontWeight: '800',
        color: '#333',
    },
    ledGrid: {
        flexDirection: "row",
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    ledBtn: {
        backgroundColor: "#e8f5e9",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: "center",
        gap: 6,
        borderWidth: 2,
        borderColor: '#c8e6c9',
        flex: 1,
        minWidth: '22%',
        justifyContent: 'center',
    },
    ledBtnActive: { 
        backgroundColor: "#41A579",
        borderColor: '#2C674D',
    },
    ledText: { 
        color: "#2C674D", 
        fontWeight: "700",
        fontSize: 13,
    },
    ledTextActive: {
        color: '#fff',
    },
    keypad: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 8,
        marginBottom: 8,
    },
    key: {
        backgroundColor: "#f0f0f0",
        width: "30%",
        aspectRatio: 1.2,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#ddd",
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    keyText: { 
        fontSize: 32, 
        fontWeight: "700", 
        color: "#333",
    },
    delKey: {
        backgroundColor: "#dc3545",
        width: "30%",
        aspectRatio: 1.2,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    btnRow: { 
        flexDirection: "row", 
        gap: 12,
        padding: 24,
        paddingTop: 16,
    },
    btn: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: 'center',
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    cancelBtn: { 
        backgroundColor: "#6c757d",
    },
    confirmBtn: { 
        backgroundColor: "#2C674D",
    },
    btnCancelText: { 
        color: "#fff", 
        fontWeight: "700",
        fontSize: 16,
    },
    btnConfirmText: { 
        color: "#fff", 
        fontWeight: "700",
        fontSize: 16,
    },
});
