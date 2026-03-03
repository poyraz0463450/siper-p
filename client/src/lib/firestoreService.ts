import { apiRequest } from '../services/api';
import type {
    Part, Model, BOMPart, SerialRecord, OperationLog,
    QualityControlRecord, ProductionOrder, Supplier,
    PurchaseRequest, TechnicalDocument, StockAlert, AppUser
} from './types';

// ========================
// USERS
// ========================
export async function getUserProfile(uid: string): Promise<AppUser | null> {
    const res = await apiRequest(`/users/${uid}`);
    return res as AppUser | null;
}
export async function getAllUsers(): Promise<AppUser[]> {
    return apiRequest('/users');
}
export async function createUserProfile(uid: string, data: Partial<AppUser>) {
    return apiRequest('/users', 'POST', { id: uid, ...data });
}
export async function updateUserProfile(uid: string, data: Partial<AppUser>) {
    return apiRequest(`/users/${uid}`, 'PUT', data);
}
export async function createPendingUser(email: string, displayName: string, role: string, allowedModules: string[]) {
    return apiRequest('/users', 'POST', { email, full_name: displayName, role, department: allowedModules[0], is_active: false });
}

// ========================
// PARTS
// ========================
export async function getAllParts(): Promise<Part[]> {
    return apiRequest('/parts');
}
export async function getPartById(id: string): Promise<Part | null> {
    return apiRequest(`/parts/${id}`);
}
export async function createPart(data: Omit<Part, 'id' | 'createdAt' | 'updatedAt'>) {
    return apiRequest('/parts', 'POST', data);
}
export async function updatePart(id: string, data: Partial<Part>) {
    return apiRequest(`/parts/${id}`, 'PUT', data);
}
export async function deletePart(id: string) {
    return apiRequest(`/parts/${id}`, 'DELETE');
}
// Firebase mock for snapshot
export function onPartsSnapshot(callback: (parts: Part[]) => void) {
    let active = true;
    apiRequest('/parts').then(parts => { if (active) callback(parts) });
    return () => { active = false; };
}
export async function getCriticalStockParts(): Promise<Part[]> {
    const parts = await getAllParts();
    return parts.filter(p => p.stockQuantity < p.minStockLevel);
}

// ========================
// MODELS
// ========================
export async function getAllModels(): Promise<Model[]> {
    return apiRequest('/models');
}
export async function createModel(data: Omit<Model, 'id' | 'createdAt' | 'updatedAt'>) {
    return apiRequest('/models', 'POST', data);
}
export async function deleteModel(id: string) {
    return apiRequest(`/models/${id}`, 'DELETE');
}
export async function getModelBOM(modelId: string): Promise<BOMPart[]> {
    return apiRequest(`/models/${modelId}/bom`);
}
export async function addBOMPart(modelId: string, data: BOMPart) {
    return apiRequest(`/models/${modelId}/bom`, 'POST', data);
}

// ========================
// SERIAL TRACKING
// ========================
export async function getAllSerials(): Promise<SerialRecord[]> {
    return apiRequest('/serials');
}
export async function getSerialByNumber(serialNumber: string): Promise<SerialRecord | null> {
    try {
        return await apiRequest(`/serials/by-number/${encodeURIComponent(serialNumber)}`);
    } catch { return null; }
}
export async function createSerial(data: any) {
    return apiRequest('/serials', 'POST', data);
}
export async function updateSerial(id: string, data: Partial<SerialRecord>) {
    return apiRequest(`/serials/${id}`, 'PUT', data);
}
export async function generateSerialNumber(_modelName: string): Promise<string> {
    return ''; // Backend auto-generates serial number
}
export async function getOperationLogs(serialId: string): Promise<OperationLog[]> {
    const detail = await apiRequest(`/serials/${serialId}`);
    return detail?.operations || [];
}
export async function addOperationLog(serialId: string, data: any) {
    return apiRequest(`/serials/${serialId}/operations`, 'POST', data);
}
export async function getQCRecords(serialId: string): Promise<QualityControlRecord[]> {
    const detail = await apiRequest(`/serials/${serialId}`);
    return detail?.qc_records || [];
}
export async function addQCRecord(serialId: string, data: any) {
    return apiRequest(`/serials/${serialId}/qc`, 'POST', data);
}

// ========================
// PRODUCTION ORDERS
// ========================
export async function getAllOrders(): Promise<ProductionOrder[]> {
    return apiRequest('/production-orders');
}
export async function createOrder(data: Omit<ProductionOrder, 'id' | 'createdAt' | 'updatedAt'>) {
    return apiRequest('/production-orders', 'POST', data);
}
export async function updateOrder(id: string, data: Partial<ProductionOrder>) {
    return apiRequest(`/production-orders/${id}`, 'PUT', data);
}
export async function deleteOrder(id: string) {
    return apiRequest(`/production-orders/${id}`, 'DELETE');
}
// Firebase mock for snapshot
export function onOrdersSnapshot(callback: (orders: ProductionOrder[]) => void) {
    let active = true;
    apiRequest('/production-orders').then(orders => { if (active) callback(orders) });
    return () => { active = false; };
}

// ========================
// SUPPLIERS
// ========================
export async function getAllSuppliers(): Promise<Supplier[]> {
    return apiRequest('/inventory/suppliers');
}
export async function createSupplier(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) {
    return apiRequest('/inventory/suppliers', 'POST', data);
}

// ========================
// PURCHASE REQUESTS
// ========================
export async function getAllPurchaseRequests(): Promise<PurchaseRequest[]> {
    return apiRequest('/inventory/purchase-requests');
}
export async function createPurchaseRequest(data: Omit<PurchaseRequest, 'id' | 'createdAt' | 'updatedAt'>) {
    return apiRequest('/inventory/purchase-requests', 'POST', data);
}
export async function updatePurchaseRequest(id: string, data: Partial<PurchaseRequest>) {
    return apiRequest(`/inventory/purchase-requests/${id}`, 'PUT', data);
}

// ========================
// DOCUMENTS
// ========================
export async function getDocumentsByPartCode(partCode: string): Promise<TechnicalDocument[]> {
    return apiRequest(`/models/documents/part/${partCode}`);
}
export async function getAllDocuments(): Promise<TechnicalDocument[]> {
    return apiRequest('/models/documents');
}
export async function addDocument(data: Omit<TechnicalDocument, 'id'>) {
    return apiRequest('/models/documents', 'POST', data);
}

// ========================
// STOCK ALERTS
// ========================
export async function getActiveAlerts(): Promise<StockAlert[]> {
    return apiRequest('/dashboard/alerts');
}
export async function createStockAlert(_data: Omit<StockAlert, 'id' | 'createdAt'>) {
    return null;
}
export async function resolveStockAlert(id: string) {
    return apiRequest(`/dashboard/alerts/${id}/resolve`, 'PUT');
}
export function onAlertsSnapshot(callback: (alerts: StockAlert[]) => void) {
    let active = true;
    apiRequest('/dashboard/alerts').then(alerts => { if (active) callback(alerts) });
    return () => { active = false; };
}

// ========================
// DASHBOARD STATS
// ========================
export async function getDashboardStats() {
    return apiRequest('/dashboard/stats');
}

// ========================
// WAREHOUSES (FAZ 1D)
// ========================
export async function fetchWarehouses() {
    return apiRequest('/inventory/meta/warehouses');
}

// ========================
// INVENTORY DETAIL (FAZ 1D)
// ========================
export async function fetchInventoryDetail(partId: string | number) {
    return apiRequest(`/inventory/${partId}`);
}
export async function adjustStock(partId: string | number, data: {
    quantity: number; type: string; notes?: string;
    warehouse_id?: number | null; lot_number?: string;
    reference_type?: string; reference_id?: number;
}) {
    return apiRequest(`/inventory/${partId}/adjust`, 'POST', data);
}
export async function fetchMovements(partId: string | number, limit = 50) {
    return apiRequest(`/inventory/${partId}/movements?limit=${limit}`);
}

// ========================
// PRODUCTION ORDER DETAIL (FAZ 1E)
// ========================
export async function fetchOrderDetail(id: string | number) {
    return apiRequest(`/production-orders/${id}`);
}
export async function changeOrderStatus(id: string | number, status: string, notes?: string) {
    return apiRequest(`/production-orders/${id}/status`, 'PUT', { status, notes });
}
export async function fetchProductionStats() {
    return apiRequest('/production-orders/stats/summary');
}
