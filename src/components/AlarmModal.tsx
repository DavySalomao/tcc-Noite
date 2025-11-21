import React from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    StyleSheet,
} from "react-native";

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
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.box}>
                    <Text style={styles.title}>Novo Alarme</Text>

                    <TextInput
                        placeholder="Nome do alarme"
                        placeholderTextColor="#888"
                        style={styles.input}
                        value={tempName}
                        onChangeText={onChangeName}
                    />

                    <View style={styles.row}>
                        <TouchableOpacity onPress={() => onSelectField("hour")}>
                            <Text
                                style={[
                                    styles.display,
                                    activeField === "hour" && styles.active,
                                    (parseInt(tempHour) > 23 || tempHour.length === 0) &&
                                    styles.invalid,
                                ]}
                            >
                                {tempHour.padStart(2, "0") || "--"}
                            </Text>
                        </TouchableOpacity>

                        <Text style={styles.dots}>:</Text>

                        <TouchableOpacity onPress={() => onSelectField("minute")}>
                            <Text
                                style={[
                                    styles.display,
                                    activeField === "minute" && styles.active,
                                    (parseInt(tempMinute) > 59 || tempMinute.length === 0) &&
                                    styles.invalid,
                                ]}
                            >
                                {tempMinute.padStart(2, "0") || "--"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.ledRow}>
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((led) => (
                            <TouchableOpacity
                                key={led}
                                style={[styles.ledBtn, tempLed === led && styles.ledActive]}
                                onPress={() => onSelectLed(led)}
                            >
                                <Text style={styles.ledText}>LED {led + 1}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

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

                        <TouchableOpacity style={styles.del} onPress={onDelete}>
                            <Text style={styles.delText}>⌫</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.btnRow}>
                        <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={onClose}>
                            <Text style={styles.btnCancelText}>Cancelar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.btn, styles.confirm]} onPress={onConfirm}>
                            <Text style={styles.btnConfirmText}>OK</Text>
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
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    box: {
        backgroundColor: "#fff",
        padding: 24,
        borderRadius: 16,
        width: "90%",
        maxWidth: 400,
        alignItems: "center",
    },
    title: { color: "#333", fontSize: 20, fontWeight: "600", marginBottom: 16 },
    input: {
        width: "100%",
        backgroundColor: "#f5f5f5",
        color: "#333",
        borderRadius: 10,
        padding: 12,
        marginBottom: 20,
        fontSize: 16,
        borderWidth: 1,
        borderColor: "#ddd",
    },
    row: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
    display: {
        fontSize: 48,
        color: "#333",
        fontWeight: "800",
        width: 80,
        textAlign: "center",
        paddingBottom: 5,
    },
    dots: { fontSize: 36, color: "#333", marginHorizontal: 5 },
    active: { borderBottomWidth: 3, borderBottomColor: "#2C674D" },
    invalid: { color: "#dc3545" },

    ledRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: 10,
    },
    ledBtn: {
        backgroundColor: "#e9ecef",
        padding: 8,
        borderRadius: 10,
        flex: 1,
        marginHorizontal: 2,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#ddd",
    },
    ledActive: { backgroundColor: "#41A579" },
    ledText: { color: "#333", fontWeight: "600" },

    keypad: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        width: "100%",
        marginBottom: 20,
    },
    key: {
        backgroundColor: "#eee",
        width: "28%",
        margin: "2%",
        aspectRatio: 1,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#ddd",
    },
    keyText: { fontSize: 28, fontWeight: "700", color: "#333" },

    del: {
        backgroundColor: "#6c757d",
        width: "28%",
        margin: "2%",
        aspectRatio: 1,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 12,
    },
    delText: { fontSize: 28, fontWeight: "700", color: "#fff" },

    btnRow: { flexDirection: "row", width: "100%", gap: 10 },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
    },
    cancel: { backgroundColor: "#6c757d" },
    confirm: { backgroundColor: "#2C674D" },
    btnCancelText: { color: "#fff", fontWeight: "700" },
    btnConfirmText: { color: "#fff", fontWeight: "700" },
});
