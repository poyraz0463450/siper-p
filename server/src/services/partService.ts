import prisma from '../prismaClient';

export const syncPartModels = async (partId: number, operationCode: string) => {
    // Defines model - code mapping
    const charToModelName: Record<string, string> = {
        'C': 'GEN1',
        'K': 'GEN2',
        'L': 'TACTİCAL',
        'M': 'FD',
        'P': 'FDX'
    };

    // Note: This must match the model names in the DB
    const allModels = ['GEN1', 'GEN2', 'TACTİCAL', 'FD', 'FDX'];

    // 1. Determine target models based on new operation code
    let targetModelNames: string[] = [];

    if (operationCode && operationCode.includes('-')) {
        const parts = operationCode.split('-');
        const suffix = parts[parts.length - 1].toUpperCase();

        // Parse suffix characters
        for (const char of suffix) {
            if (charToModelName[char]) {
                targetModelNames.push(charToModelName[char]);
            }
        }
    } else {
        // No hyphen -> Link to ALL models
        targetModelNames = allModels;
    }

    // 2. Fetch all model IDs
    const models = await prisma.model.findMany();
    const modelMap = new Map(models.map(m => [m.name, m.id]));

    const targetModelIds = targetModelNames
        .map(name => modelMap.get(name))
        .filter((id): id is number => id !== undefined);

    // 3. Transaction to update links
    await prisma.$transaction(async (tx) => {
        // Remove existing links
        await tx.modelPart.deleteMany({
            where: { part_id: partId }
        });

        // Create new links
        if (targetModelIds.length > 0) {
            await tx.modelPart.createMany({
                data: targetModelIds.map(modelId => ({
                    model_id: modelId,
                    part_id: partId,
                    quantity_required: 1 // Default
                }))
            });
        }
    });
};
