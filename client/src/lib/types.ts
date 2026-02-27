// ========================
// USER & AUTH
// ========================
export type UserRole = 'Admin' | 'Engineer' | 'Technician';

export interface AppUser {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    isApproved: boolean;
    allowedModules: string[];
    createdAt: any; // Firestore Timestamp
}

// ========================
// PARTS & INVENTORY
// ========================
export type PartCategory = 'Namlu' | 'Sürgü' | 'Gövde' | 'Şarjör' | 'Tetik Mekanizması' | 'Diğer';

export interface Part {
    id: string;
    name: string;
    partCode: string; // BRG00-01-64-XXXX
    category: PartCategory;
    material?: string;
    heatTreatment?: string;
    coating?: string;
    operationCode?: string;
    locationCode?: string;
    imageUrl?: string;
    stockQuantity: number;
    minStockLevel: number;
    averageCost: number;
    currency: string;
    createdAt: any;
    updatedAt: any;
}

// ========================
// MODELS & BOM
// ========================
export interface Model {
    id: string;
    name: string;
    description?: string;
    createdAt: any;
    updatedAt: any;
}

export interface BOMPart {
    partId: string;
    partCode: string;
    partName: string;
    quantityRequired: number;
}

// ========================
// SERIAL TRACKING
// ========================
export type SerialStatus = 'in_production' | 'completed' | 'shipped' | 'returned';

export interface SubPartSerials {
    namlu?: string;
    surgu?: string;
    govde?: string;
    sarjor?: string;
    tetikMekanizmasi?: string;
}

export interface SerialRecord {
    id: string;
    serialNumber: string;
    modelId: string;
    modelName: string;
    status: SerialStatus;
    subParts: SubPartSerials;
    createdAt: any;
    completedAt?: any;
}

// ========================
// OPERATION LOGS
// ========================
export type OperationType = 'CNC' | 'Isıl İşlem' | 'Kaplama' | 'Montaj' | 'Atış Testi' | 'Rodaj' | 'Kalite Kontrol';
export type PartType = 'Namlu' | 'Sürgü' | 'Gövde' | 'Şarjör' | 'Ana Montaj';

export interface OperationLog {
    id: string;
    partType: PartType;
    operation: OperationType;
    machine?: string;
    personnelName: string;
    personnelId?: string;
    startTime: any;
    endTime?: any;
    notes?: string;
    createdAt: any;
}

// ========================
// QUALITY CONTROL
// ========================
export type QCTestType = 'Mikrometre' | 'Yüzey Pürüzlülüğü' | 'Atış Testi' | 'Rodaj' | 'Görsel Kontrol';

export interface Measurement {
    dimension: string;
    tolerance: string;
    actual: number;
    pass: boolean;
}

export interface FiringTestData {
    roundsFired: number;
    malfunctions: number;
    malfunctionDetails?: string;
    notes?: string;
}

export interface RodajData {
    cycleCount: number;
    resultNotes: string;
    pass: boolean;
}

export interface QualityControlRecord {
    id: string;
    testType: QCTestType;
    measurements?: Measurement[];
    firingTestData?: FiringTestData;
    rodajData?: RodajData;
    inspector: string;
    inspectorId?: string;
    testDate: any;
    pass: boolean;
    createdAt: any;
}

// ========================
// PRODUCTION ORDERS
// ========================
export type OrderStatus = 'planned' | 'pending_approval' | 'in_progress' | 'quality_check' | 'completed' | 'cancelled';
export type OrderPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ProductionOrder {
    id: string;
    orderCode: string;
    modelId: string;
    modelName: string;
    quantity: number;
    priority: OrderPriority;
    status: OrderStatus;
    notes?: string;
    dueDate?: any;
    startedAt?: any;
    completedAt?: any;
    realizedCost?: number;
    createdAt: any;
    updatedAt: any;
}

// ========================
// SUPPLIERS & PROCUREMENT
// ========================
export interface Supplier {
    id: string;
    name: string;
    contact?: string;
    phone?: string;
    email?: string;
    createdAt: any;
    updatedAt: any;
}

export type PRStatus = 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseRequest {
    id: string;
    prCode: string;
    partId: string;
    partName: string;
    orderId?: string;
    quantity: number;
    status: PRStatus;
    supplierId?: string;
    supplierName?: string;
    unitPrice?: number;
    notes?: string;
    createdAt: any;
    updatedAt: any;
}

// ========================
// DOCUMENTS
// ========================
export interface TechnicalDocument {
    id: string;
    partCode: string;
    title: string;
    revisionNumber: number;
    fileUrl: string;
    fileType: string;
    uploadedBy: string;
    uploadedAt: any;
    isLatest: boolean;
}

// ========================
// STOCK ALERTS
// ========================
export type AlertType = 'critical' | 'warning';

export interface StockAlert {
    id: string;
    partId: string;
    partName: string;
    partCode: string;
    currentStock: number;
    minLevel: number;
    alertType: AlertType;
    createdAt: any;
    resolvedAt?: any;
}
