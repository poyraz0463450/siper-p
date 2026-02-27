import { Request, Response } from 'express';
import prisma from '../prismaClient';

export const getParts = async (req: Request, res: Response) => {
    try {
        const parts = await prisma.part.findMany({
            orderBy: { name: 'asc' },
        });
        res.json(parts);
    } catch (error) {
        res.status(500).json({ error: 'Parçalar getirilirken hata oluştu.' });
    }
};

export const createPart = async (req: Request, res: Response) => {
    try {
        const { name, material, heat_treatment, coating, operation_code, location_code, image_url, stock_quantity, min_stock_level } = req.body;

        const part = await prisma.part.create({
            data: {
                name,
                material,
                heat_treatment,
                coating,
                operation_code,
                location_code,
                image_url,
                stock_quantity: Number(stock_quantity) || 0,
                min_stock_level: Number(min_stock_level) || 0,
            },
        });

        // Sync with models based on operation code
        if (operation_code) {
            const { syncPartModels } = await import('../services/partService');
            await syncPartModels(part.id, operation_code);
        }

        res.status(201).json(part);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Parça oluşturulurken hata oluştu.' });
    }
};

export const updatePart = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, material, heat_treatment, coating, operation_code, location_code, image_url, stock_quantity, min_stock_level } = req.body;

        const part = await prisma.part.update({
            where: { id: Number(id) },
            data: {
                name,
                material,
                heat_treatment,
                coating,
                operation_code,
                location_code,
                image_url,
                stock_quantity: Number(stock_quantity),
                min_stock_level: Number(min_stock_level),
            },
        });

        // Sync models based on new code
        if (operation_code) {
            // Dynamic import to avoid circular dep if any (though here it's fine)
            const { syncPartModels } = await import('../services/partService');
            await syncPartModels(part.id, operation_code);
        }

        res.json(part);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Parça güncellenirken hata oluştu.' });
    }
};

export const deletePart = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.$transaction(async (tx) => {
            // First delete associations in ModelPart
            await tx.modelPart.deleteMany({
                where: { part_id: Number(id) }
            });

            // Then delete the part
            await tx.part.delete({
                where: { id: Number(id) }
            });
        });

        res.json({ message: 'Parça silindi.' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Parça silinirken hata oluştu.' });
    }
};
