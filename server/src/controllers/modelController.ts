import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';

interface PartItem {
    part_id: number;
    quantity_required: number;
}

export const getModels = async (req: Request, res: Response) => {
    try {
        const models = await prisma.model.findMany({
            include: {
                model_parts: {
                    include: {
                        part: true,
                    },
                },
            },
        });
        // Transform model_parts to parts for frontend compatibility
        const transformedModels = models.map(model => ({
            ...model,
            parts: model.model_parts,
            model_parts: undefined
        }));
        res.json(transformedModels);
    } catch (error) {
        console.error('❌ getModels ERROR:', error);
        res.status(500).json({ error: 'Modeller getirilirken hata oluştu.' });
    }
};

export const createModel = async (req: Request, res: Response) => {
    try {
        const { name, description, parts } = req.body; // parts: PartItem[]

        // Transaction to create model and link parts
        const model = await prisma.$transaction(async (tx: any) => {
            const newModel = await tx.model.create({
                data: {
                    name,
                    description,
                },
            });

            if (parts && parts.length > 0) {
                const modelParts = parts.map((p: PartItem) => ({
                    model_id: newModel.id,
                    part_id: p.part_id,
                    quantity_required: p.quantity_required,
                }));

                await tx.modelPart.createMany({
                    data: modelParts,
                });
            }

            return newModel;
        });

        res.status(201).json(model);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Model oluşturulurken hata oluştu. İsim benzersiz olmalı.' });
    }
};

export const getModelById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const model = await prisma.model.findUnique({
            where: { id: Number(id) },
            include: {
                model_parts: {
                    include: {
                        part: true,
                    },
                },
            },
        });

        if (!model) {
            res.status(404).json({ error: 'Model bulunamadı.' });
            return;
        }

        // Transform model_parts to parts for frontend compatibility
        const transformedModel = {
            ...model,
            parts: model.model_parts,
            model_parts: undefined
        };
        res.json(transformedModel);
    } catch (error) {
        res.status(500).json({ error: 'Model getirilirken hata oluştu.' });
    }
};

export const updateModelPart = async (req: Request, res: Response) => {
    try {
        const { modelId, partId } = req.params;
        const { quantity_required } = req.body;

        const updated = await prisma.modelPart.update({
            where: {
                part_id_model_id: {
                    model_id: Number(modelId),
                    part_id: Number(partId),
                },
            },
            data: {
                quantity_required: Number(quantity_required),
            },
        });

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Reçete güncellenirken hata oluştu.' });
    }
};

export const deleteModelPart = async (req: Request, res: Response) => {
    try {
        const { modelId, partId } = req.params;

        await prisma.modelPart.delete({
            where: {
                part_id_model_id: {
                    model_id: Number(modelId),
                    part_id: Number(partId),
                }
            }
        });

        res.json({ message: 'Parça reçeteden çıkarıldı.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Parça reçeteden çıkarılırken hata oluştu.' });
    }
};
