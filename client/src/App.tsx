import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Models from './pages/Models';
import Production from './pages/Production';
import Procurement from './pages/Procurement';
import AuditLogs from './pages/AuditLogs';
import SerialTracking from './pages/SerialTracking';
import QualityControl from './pages/QualityControl';
import DocumentCenter from './pages/DocumentCenter';
import AdminPanel from './pages/AdminPanel';
import Reports from './pages/Reports';
import Layout from './layouts/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span className="text-sm text-muted-foreground">Yükleniyor...</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'Admin') {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="models" element={<Models />} />
            <Route path="production" element={<Production />} />
            <Route path="procurement" element={<Procurement />} />
            <Route path="serial-tracking" element={<SerialTracking />} />
            <Route path="quality-control" element={<QualityControl />} />
            <Route path="documents" element={<DocumentCenter />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="reports" element={<Reports />} />
            <Route path="admin" element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            } />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
