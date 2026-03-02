import {
    collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
    query, where, orderBy, limit, onSnapshot, serverTimestamp,
    writeBatch, setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import type {
    Part, Model, BOMPart, SerialRecord, OperationLog,
    QualityControlRecord, ProductionOrder, Supplier,
    PurchaseRequest, TechnicalDocument, StockAlert, AppUser
} from './types';

// ========================
// USERS
// ========================
export const usersRef = collection(db, 'users');

export async function getUserProfile(uid: string): Promise<AppUser | null> {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...snap.data() } as AppUser;
}

export async function getAllUsers(): Promise<AppUser[]> {
    const snap = await getDocs(query(usersRef, orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser));
}

export async function createUserProfile(uid: string, data: Partial<AppUser>) {
    await setDoc(doc(db, 'users', uid), {
        ...data,
        createdAt: serverTimestamp(),
    });
}

export async function updateUserProfile(uid: string, data: Partial<AppUser>) {
    await updateDoc(doc(db, 'users', uid), data);
}

// pendingUsers — admin creates users here, then a process creates the auth account
export async function createPendingUser(email: string, displayName: string, role: string, allowedModules: string[]) {
    return addDoc(collection(db, 'pendingUsers'), {
        email, displayName, role, allowedModules,
        status: 'pending',
        createdAt: serverTimestamp(),
    });
}

// ========================
// PARTS
// ========================
export const partsRef = collection(db, 'parts');

export async function getAllParts(): Promise<Part[]> {
    const snap = await getDocs(query(partsRef, orderBy('partCode', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Part));
}

export async function getPartById(id: string): Promise<Part | null> {
    const snap = await getDoc(doc(db, 'parts', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Part;
}

export async function createPart(data: Omit<Part, 'id' | 'createdAt' | 'updatedAt'>) {
    return addDoc(partsRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

export async function updatePart(id: string, data: Partial<Part>) {
    await updateDoc(doc(db, 'parts', id), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

export async function deletePart(id: string) {
    await deleteDoc(doc(db, 'parts', id));
}

export function onPartsSnapshot(callback: (parts: Part[]) => void) {
    return onSnapshot(query(partsRef, orderBy('partCode', 'asc')), (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Part)));
    });
}

export async function getCriticalStockParts(): Promise<Part[]> {
    const snap = await getDocs(partsRef);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Part))
        .filter(p => p.stockQuantity < p.minStockLevel);
}

// ========================
// MODELS
// ========================
export const modelsRef = collection(db, 'models');

export async function getAllModels(): Promise<Model[]> {
    const snap = await getDocs(query(modelsRef, orderBy('name', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Model));
}

export async function createModel(data: Omit<Model, 'id' | 'createdAt' | 'updatedAt'>) {
    return addDoc(modelsRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

export async function getModelBOM(modelId: string): Promise<BOMPart[]> {
    const snap = await getDocs(collection(db, 'models', modelId, 'bomParts'));
    return snap.docs.map(d => ({ ...d.data() } as BOMPart));
}

export async function addBOMPart(modelId: string, data: BOMPart) {
    return addDoc(collection(db, 'models', modelId, 'bomParts'), data);
}

// ========================
// SERIAL TRACKING
// ========================
export const serialRef = collection(db, 'serialTracking');

export async function getAllSerials(): Promise<SerialRecord[]> {
    const snap = await getDocs(query(serialRef, orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SerialRecord));
}

export async function getSerialByNumber(serialNumber: string): Promise<SerialRecord | null> {
    const q = query(serialRef, where('serialNumber', '==', serialNumber), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as SerialRecord;
}

export async function createSerial(data: Omit<SerialRecord, 'id' | 'createdAt'>) {
    return addDoc(serialRef, {
        ...data,
        createdAt: serverTimestamp(),
    });
}

export async function updateSerial(id: string, data: Partial<SerialRecord>) {
    await updateDoc(doc(db, 'serialTracking', id), data);
}

export async function generateSerialNumber(modelName: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `BRG9-${modelName.replace(/\s+/g, '').substring(0, 6).toUpperCase()}-${year}`;
    const q = query(serialRef, where('serialNumber', '>=', prefix), where('serialNumber', '<=', prefix + '\uf8ff'));
    const snap = await getDocs(q);
    const nextSeq = (snap.size + 1).toString().padStart(4, '0');
    return `${prefix}-${nextSeq}`;
}

// Operation Logs (subcollection)
export async function getOperationLogs(serialId: string): Promise<OperationLog[]> {
    const snap = await getDocs(
        query(collection(db, 'serialTracking', serialId, 'operationLogs'), orderBy('createdAt', 'asc'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as OperationLog));
}

export async function addOperationLog(serialId: string, data: Omit<OperationLog, 'id' | 'createdAt'>) {
    return addDoc(collection(db, 'serialTracking', serialId, 'operationLogs'), {
        ...data,
        createdAt: serverTimestamp(),
    });
}

// Quality Control (subcollection)
export async function getQCRecords(serialId: string): Promise<QualityControlRecord[]> {
    const snap = await getDocs(
        query(collection(db, 'serialTracking', serialId, 'qualityControl'), orderBy('createdAt', 'asc'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as QualityControlRecord));
}

export async function addQCRecord(serialId: string, data: Omit<QualityControlRecord, 'id' | 'createdAt'>) {
    return addDoc(collection(db, 'serialTracking', serialId, 'qualityControl'), {
        ...data,
        createdAt: serverTimestamp(),
    });
}

// ========================
// PRODUCTION ORDERS
// ========================
export const ordersRef = collection(db, 'productionOrders');

export async function getAllOrders(): Promise<ProductionOrder[]> {
    const snap = await getDocs(query(ordersRef, orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionOrder));
}

export async function createOrder(data: Omit<ProductionOrder, 'id' | 'createdAt' | 'updatedAt'>) {
    const year = new Date().getFullYear();
    const snap = await getDocs(ordersRef);
    const nextSeq = (snap.size + 1).toString().padStart(4, '0');
    return addDoc(ordersRef, {
        ...data,
        orderCode: `UE-${year}-${nextSeq}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

export async function updateOrder(id: string, data: Partial<ProductionOrder>) {
    await updateDoc(doc(db, 'productionOrders', id), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

export async function deleteOrder(id: string) {
    await deleteDoc(doc(db, 'productionOrders', id));
}

export function onOrdersSnapshot(callback: (orders: ProductionOrder[]) => void) {
    return onSnapshot(query(ordersRef, orderBy('createdAt', 'desc')), (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionOrder)));
    });
}

// ========================
// SUPPLIERS
// ========================
export const suppliersRef = collection(db, 'suppliers');

export async function getAllSuppliers(): Promise<Supplier[]> {
    const snap = await getDocs(query(suppliersRef, orderBy('name', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier));
}

export async function createSupplier(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) {
    return addDoc(suppliersRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

// ========================
// PURCHASE REQUESTS
// ========================
export const purchaseRef = collection(db, 'purchaseRequests');

export async function getAllPurchaseRequests(): Promise<PurchaseRequest[]> {
    const snap = await getDocs(query(purchaseRef, orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseRequest));
}

export async function createPurchaseRequest(data: Omit<PurchaseRequest, 'id' | 'createdAt' | 'updatedAt'>) {
    const year = new Date().getFullYear();
    const snap = await getDocs(purchaseRef);
    const nextSeq = (snap.size + 1).toString().padStart(4, '0');
    return addDoc(purchaseRef, {
        ...data,
        prCode: `PR-${year}-${nextSeq}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

export async function updatePurchaseRequest(id: string, data: Partial<PurchaseRequest>) {
    await updateDoc(doc(db, 'purchaseRequests', id), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

// ========================
// DOCUMENTS
// ========================
export const documentsRef = collection(db, 'documents');

export async function getDocumentsByPartCode(partCode: string): Promise<TechnicalDocument[]> {
    const q = query(documentsRef, where('partCode', '==', partCode), orderBy('revisionNumber', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalDocument));
}

export async function getAllDocuments(): Promise<TechnicalDocument[]> {
    const snap = await getDocs(query(documentsRef, orderBy('uploadedAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalDocument));
}

export async function addDocument(data: Omit<TechnicalDocument, 'id'>) {
    // Mark old revisions as not latest
    if (data.isLatest) {
        const existing = await getDocs(
            query(documentsRef, where('partCode', '==', data.partCode), where('isLatest', '==', true))
        );
        const batch = writeBatch(db);
        existing.docs.forEach(d => {
            batch.update(d.ref, { isLatest: false });
        });
        await batch.commit();
    }
    return addDoc(documentsRef, data);
}

// ========================
// STOCK ALERTS
// ========================
export const alertsRef = collection(db, 'stockAlerts');

export async function getActiveAlerts(): Promise<StockAlert[]> {
    const q = query(alertsRef, where('resolvedAt', '==', null), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StockAlert));
}

export async function createStockAlert(data: Omit<StockAlert, 'id' | 'createdAt'>) {
    return addDoc(alertsRef, {
        ...data,
        createdAt: serverTimestamp(),
        resolvedAt: null,
    });
}

export async function resolveStockAlert(id: string) {
    await updateDoc(doc(db, 'stockAlerts', id), {
        resolvedAt: serverTimestamp(),
    });
}

export function onAlertsSnapshot(callback: (alerts: StockAlert[]) => void) {
    return onSnapshot(
        query(alertsRef, where('resolvedAt', '==', null), orderBy('createdAt', 'desc')),
        (snap) => {
            callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockAlert)));
        }
    );
}

// ========================
// DASHBOARD STATS
// ========================
export async function getDashboardStats() {
    const [parts, orders, alerts] = await Promise.all([
        getDocs(partsRef),
        getDocs(ordersRef),
        getActiveAlerts(),
    ]);

    const allParts = parts.docs.map(d => ({ id: d.id, ...d.data() } as Part));
    const allOrders = orders.docs.map(d => ({ id: d.id, ...d.data() } as ProductionOrder));

    return {
        totalParts: allParts.length,
        criticalStock: allParts.filter(p => p.stockQuantity < p.minStockLevel).length,
        activeOrders: allOrders.filter(o => ['in_progress', 'quality_check'].includes(o.status)).length,
        pendingOrders: allOrders.filter(o => o.status === 'planned' || o.status === 'pending_approval').length,
        completedOrders: allOrders.filter(o => o.status === 'completed').length,
        activeAlerts: alerts.length,
    };
}
