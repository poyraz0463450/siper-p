// src/services/api.ts
// REST API Wrapper for SİPER-P PostgreSQL Backend

const API_BASE_URL = 'http://localhost:5000/api';

// Request Helper
export const apiRequest = async (endpoint: string, method: string = 'GET', body?: any) => {
    const token = localStorage.getItem('token');

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

        // Handle 401 Unauthorized (Token Expired, etc.)
        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return { error: 'Unauthorized', status: 401 };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error);
        throw error;
    }
};

// ----------------------------------------------------
// Auth APIs
// ----------------------------------------------------
export const loginApi = (credentials: any) => apiRequest('/auth/login', 'POST', credentials);
export const meApi = () => apiRequest('/auth/me', 'GET');

// ----------------------------------------------------
// Dashboard APIs
// ----------------------------------------------------
export const getDashboardStats = () => apiRequest('/stats/summary', 'GET');

// ----------------------------------------------------
// Data APIs (Mock wrappers for now, will map to backend)
// ----------------------------------------------------
// Parts
export const fetchParts = () => apiRequest('/parts', 'GET');
export const createPart = (data: any) => apiRequest('/parts', 'POST', data);
export const updatePart = (id: string, data: any) => apiRequest(`/parts/${id}`, 'PUT', data);
export const deletePart = (id: string) => apiRequest(`/parts/${id}`, 'DELETE');

// Models
export const fetchModels = () => apiRequest('/models', 'GET');

// Inventory
export const fetchInventory = () => apiRequest('/inventory', 'GET');

// Production
export const fetchProductionOrders = () => apiRequest('/production-orders', 'GET');

// Quality
export const fetchQcInspections = () => apiRequest('/qc-inspections', 'GET');

// Audit Logs
export const fetchAuditLogs = () => apiRequest('/audit-logs', 'GET');
