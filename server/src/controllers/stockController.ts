import { Request, Response } from 'express';
import prisma from '../prismaClient';

export const createReservation = async (req: Request, res: Response) => {
    try {
        const { part_id, order_id, quantity } = req.body;

        // Check availability first
        const part = await prisma.part.findUnique({
            where: { id: Number(part_id) },
            include: { stockReservations: { where: { status: 'active' } } }
        });

        if (!part) return res.status(404).json({ error: 'Parça bulunamadı' });

        const reservedTotal = part.stockReservations.reduce((sum, r) => sum + r.quantity, 0);
        const available = part.stock_quantity - reservedTotal;

        if (available < quantity) {
            // We can reserve whatever is available, or fail. 
            // Usually we reserve what we can? Or strict?
            // User requirement: "Reserve available pieces". So allow partial or full.
            // Let's implement full reservation if possible, or up to available.
            // But usually reservation implies we are locking it for this order.

            // For this MVP, let's just reserve requested amount even if it drives "virtual available" negative?
            // No, that defeats the purpose.
            // Let's reserve MIN(available, quantity).
        }

        const quantityToReserve = Math.min(Math.max(0, available), Number(quantity));

        if (quantityToReserve <= 0) {
            return res.status(400).json({ error: 'Yeterli stok yok, rezervasyon yapılamadı.' });
        }

        const reservation = await prisma.stockReservation.create({
            data: {
                part_id: Number(part_id),
                order_id: Number(order_id),
                quantity: quantityToReserve,
                status: 'active'
            }
        });

        res.status(201).json(reservation);
    } catch (error) {
        console.error('Reservation error:', error);
        res.status(500).json({ error: 'Rezervasyon oluşturulurken hata oluştu.' });
    }
};

export const getReservations = async (req: Request, res: Response) => {
    try {
        const { order_id } = req.query;
        const where = order_id ? { order_id: Number(order_id) } : {};

        const reservations = await prisma.stockReservation.findMany({
            where,
            include: { part: true, order: true }
        });
        res.json(reservations);
    } catch (error) {
        res.status(500).json({ error: 'Rezervasyonlar getirilirken hata oluştu.' });
    }
};
