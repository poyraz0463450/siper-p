import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes';
import partRoutes from './routes/partRoutes';
import modelRoutes from './routes/modelRoutes';
import orderRoutes from './routes/orderRoutes';
import dashboardRoutes from './routes/dashboardRoutes';

import uploadRoutes from './routes/uploadRoutes';
import procurementRoutes from './routes/procurementRoutes';
import stockRoutes from './routes/stockRoutes';

import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/parts', partRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/stock', stockRoutes);

// Basic health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Manufacturing ERP API is running' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
