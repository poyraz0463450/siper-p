export interface AuditLogItem {
    id: string;
    action: 'create' | 'update' | 'delete' | 'status_change' | 'login';
    entity: 'Part' | 'Order' | 'System';
    details: string;
    timestamp: string;
    user: string;
}

const STORAGE_KEY = 'erp_audit_logs';

export const addLog = (
    action: AuditLogItem['action'],
    entity: AuditLogItem['entity'],
    details: string,
    user: string = 'Admin' // Default user for now
) => {
    try {
        const logs: AuditLogItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const newLog: AuditLogItem = {
            id: crypto.randomUUID(),
            action,
            entity,
            details,
            timestamp: new Date().toISOString(),
            user
        };
        // Keep last 100 logs
        const updatedLogs = [newLog, ...logs].slice(0, 100);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
    } catch (error) {
        console.error('Failed to save audit log', error);
    }
};

export const getLogs = (): AuditLogItem[] => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (error) {
        return [];
    }
};

export const clearLogs = () => {
    localStorage.removeItem(STORAGE_KEY);
};
