export type AlarmType = {
    id: number;
    hour: string;
    minute: string;
    name: string;
    led: number;
    enabled: boolean;
};

export type AlertItem = {
    id: number;
    timestamp: number;
    title: string;
    message: string;
};
