import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';

// Generate unique order code like UE-2026-0001
const generateOrderCode = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const prefix = `UE-${year}-`;

    // Find the last order code for this year
    const lastOrder = await prisma.productionOrder.findFirst({
        where: { order_code: { startsWith: prefix } },
        orderBy: { order_code: 'desc' },
    });

    let nextNumber = 1;
    if (lastOrder) {
        const lastNumber = parseInt(lastOrder.order_code.split('-')[2], 10);
        nextNumber = lastNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
};

export const getOrders = async (req: Request, res: Response) => {
    try {
        const { status, priority, search, from, to } = req.query;

        const where: Prisma.ProductionOrderWhereInput = {};

        // Filter by status
        if (status && status !== 'all') {
            where.status = status as string;
        }

        // Filter by priority
        if (priority && priority !== 'all') {
            where.priority = priority as string;
        }

        // Search by order_code or notes
        if (search) {
            where.OR = [
                { order_code: { contains: search as string } },
                { notes: { contains: search as string } },
            ];
        }

        // Filter by date range
        if (from || to) {
            where.created_at = {};
            if (from) where.created_at.gte = new Date(from as string);
            if (to) where.created_at.lte = new Date(to as string);
        }

        const orders = await prisma.productionOrder.findMany({
            where,
            include: {
                model: {
                    include: {
                        model_parts: {
                            include: {
                                part: {
                                    include: {
                                        purchaseRequests: {
                                            where: { status: { not: 'received' } } // Only active PRs
                                        },
                                        stockReservations: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: [
                { priority: 'desc' }, // urgent first
                { created_at: 'desc' }
            ],
        });

        // Sort by priority manually (urgent > high > normal > low)
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        orders.sort((a, b) => {
            const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
            const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
            if (aPriority !== bPriority) return aPriority - bPriority;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        // Transform model_parts to parts for frontend compatibility
        const transformedOrders = orders.map(order => ({
            ...order,
            model: {
                ...order.model,
                parts: order.model.model_parts,
                model_parts: undefined
            }
        }));

        res.json(transformedOrders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Siparişler getirilirken hata oluştu.' });
    }
};

export const getOrderById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const order = await prisma.productionOrder.findUnique({
            where: { id: Number(id) },
            include: {
                model: {
                    include: {
                        model_parts: {
                            include: {
                                part: {
                                    include: {
                                        purchaseRequests: {
                                            where: { status: { not: 'received' } }
                                        },
                                        stockReservations: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
        });

        if (!order) {
            res.status(404).json({ error: 'Sipariş bulunamadı.' });
            return;
        }

        // Transform model_parts to parts for frontend compatibility
        const transformedOrder = {
            ...order,
            model: {
                ...order.model,
                parts: order.model.model_parts,
                model_parts: undefined
            }
        };

        res.json(transformedOrder);
    } catch (error) {
        res.status(500).json({ error: 'Sipariş detayı getirilirken hata oluştu.' });
    }
};

export const createOrder = async (req: Request, res: Response) => {
    try {
        const { model_id, quantity, priority, notes, due_date } = req.body;

        const order_code = await generateOrderCode();

        const order = await prisma.$transaction(async (tx) => {
            const createdOrder = await tx.productionOrder.create({
                data: {
                    order_code,
                    model_id,
                    quantity: Number(quantity) || 1,
                    priority: priority || 'normal',
                    status: 'planned',
                    notes: notes || null,
                    due_date: due_date ? new Date(due_date) : null,
                },
                include: {
                    model: {
                        include: {
                            model_parts: {
                                include: {
                                    part: {
                                        include: {
                                            stockReservations: {
                                                where: { status: 'active' } // for calculation
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
            });

            // Create reservations
            for (const mp of createdOrder.model.model_parts) {
                const required = mp.quantity_required * createdOrder.quantity;
                const reservedAlready = mp.part.stockReservations.reduce((acc: number, r: { quantity: number }) => acc + r.quantity, 0);
                const available = Math.max(0, mp.part.stock_quantity - reservedAlready);
                const toReserve = Math.min(required, available);

                if (toReserve > 0) {
                    await tx.stockReservation.create({
                        data: {
                            part_id: mp.part_id,
                            order_id: createdOrder.id,
                            quantity: toReserve,
                            status: 'active'
                        }
                    });
                }
            }

            return createdOrder;
        });

        // Transform model_parts to parts for frontend compatibility
        const transformedOrder = {
            ...order,
            model: {
                ...order.model,
                parts: order.model.model_parts,
                model_parts: undefined
            }
        };

        res.status(201).json(transformedOrder);
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Sipariş oluşturulurken hata oluştu.' });
    }
};

export const updateOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { quantity, priority, notes, due_date } = req.body;

        const order = await prisma.productionOrder.update({
            where: { id: Number(id) },
            data: {
                quantity: quantity !== undefined ? Number(quantity) : undefined,
                priority: priority || undefined,
                notes: notes !== undefined ? notes : undefined,
                due_date: due_date ? new Date(due_date) : undefined,
            },
            include: { model: true },
        });

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Sipariş güncellenirken hata oluştu.' });
    }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Valid status transitions
        const validStatuses = ['planned', 'pending_approval', 'in_progress', 'quality_check', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({ error: 'Geçersiz durum.' });
            return;
        }

        const currentOrder = await prisma.productionOrder.findUnique({
            where: { id: Number(id) },
            include: { model: { include: { model_parts: true } } },
        });

        if (!currentOrder) {
            res.status(404).json({ error: 'Sipariş bulunamadı.' });
            return;
        }

        if (currentOrder.status === 'completed') {
            res.status(400).json({ error: 'Tamamlanmış sipariş değiştirilemez.' });
            return;
        }

        if (currentOrder.status === 'cancelled') {
            res.status(400).json({ error: 'İptal edilmiş sipariş değiştirilemez.' });
            return;
        }

        // Handle completion - check and deduct stock
        if (status === 'completed') {
            // Check stock availability
            for (const item of currentOrder.model.model_parts) {
                const required = item.quantity_required * currentOrder.quantity;
                const part = await prisma.part.findUnique({ where: { id: item.part_id } });

                if (!part || part.stock_quantity < required) {
                    res.status(400).json({
                        error: `Yetersiz Stok: ${part?.name || 'Bilinmeyen Parça'}. Gerekli: ${required}, Mevcut: ${part?.stock_quantity}`
                    });
                    return;
                }
            }

            // Deduct stock in transaction & consume reservations
            await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                await tx.productionOrder.update({
                    where: { id: Number(id) },
                    data: {
                        status: 'completed',
                        completed_at: new Date()
                    },
                });

                // Mark reservations as consumed
                await tx.stockReservation.updateMany({
                    where: { order_id: Number(id), status: 'active' },
                    data: { status: 'consumed' }
                });

                for (const item of currentOrder.model.model_parts) {
                    await tx.part.update({
                        where: { id: item.part_id },
                        data: {
                            stock_quantity: {
                                decrement: item.quantity_required * currentOrder.quantity,
                            },
                        },
                    });
                }
            });

            res.json({ message: 'Sipariş tamamlandı ve stoklar düşüldü.' });
            return;
        }

        // Handle status changes with timestamps
        const updateData: Prisma.ProductionOrderUpdateInput = { status };

        if (status === 'in_progress' && !currentOrder.started_at) {
            updateData.started_at = new Date();
        }

        // Handle cancellation - release reservations
        if (status === 'cancelled') {
            updateData.completed_at = new Date();
            await prisma.stockReservation.updateMany({
                where: { order_id: Number(id), status: 'active' },
                data: { status: 'released' }
            });
        }

        const updatedOrder = await prisma.productionOrder.update({
            where: { id: Number(id) },
            data: updateData,
            include: { model: true },
        });

        res.json(updatedOrder);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Sipariş güncellenirken hata oluştu.' });
    }
};

export const deleteOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const order = await prisma.productionOrder.findUnique({
            where: { id: Number(id) },
        });

        if (!order) {
            res.status(404).json({ error: 'Sipariş bulunamadı.' });
            return;
        }

        if (order.status === 'completed') {
            res.status(400).json({ error: 'Tamamlanmış sipariş silinemez.' });
            return;
        }

        // Delete reservations first
        await prisma.stockReservation.deleteMany({
            where: { order_id: Number(id) }
        });

        await prisma.productionOrder.delete({
            where: { id: Number(id) },
        });

        res.json({ message: 'Sipariş silindi.' });
    } catch (error) {
        res.status(500).json({ error: 'Sipariş silinirken hata oluştu.' });
    }
};

// Get order statistics for dashboard
export const getOrderStats = async (req: Request, res: Response) => {
    try {
        const stats = await prisma.productionOrder.groupBy({
            by: ['status'],
            _count: { id: true },
        });

        const result = {
            planned: 0,
            pending_approval: 0,
            in_progress: 0,
            quality_check: 0,
            completed: 0,
            cancelled: 0,
            total: 0,
        };

        stats.forEach((s) => {
            result[s.status as keyof typeof result] = s._count.id;
            result.total += s._count.id;
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'İstatistikler getirilirken hata oluştu.' });
    }
};
