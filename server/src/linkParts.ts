import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping: operation_code suffix → model name
const MODEL_MAPPING: Record<string, string> = {
    'C': 'GEN1',
    'K': 'GEN2',
    'L': 'TACTİCAL',
    'M': 'FD',
    'P': 'FDX'
};

function getModelNamesForPart(operationCode: string | null): string[] {
    if (!operationCode) return Object.values(MODEL_MAPPING); // ALL models

    // Check if code has suffix like BRG9001-C or BRG9001-CKL
    const parts = operationCode.split('-');
    if (parts.length < 2) return Object.values(MODEL_MAPPING); // No suffix = ALL models

    const suffix = parts[parts.length - 1].toUpperCase();

    // Check each character in suffix
    const models: string[] = [];
    for (const char of suffix) {
        if (MODEL_MAPPING[char]) {
            models.push(MODEL_MAPPING[char]);
        }
    }

    // If no matching suffix found, it's for ALL models
    return models.length > 0 ? models : Object.values(MODEL_MAPPING);
}

async function linkPartsToModelsCorrectly() {
    console.log('🧹 Clearing existing ModelPart links...');
    await prisma.modelPart.deleteMany({});

    console.log('📊 Fetching parts and models...');
    const parts = await prisma.part.findMany();
    const models = await prisma.model.findMany();

    console.log(`Found ${parts.length} parts and ${models.length} models`);

    const modelMap = new Map(models.map(m => [m.name, m.id]));

    let created = 0;
    const stats: Record<string, number> = {};

    for (const part of parts) {
        const targetModels = getModelNamesForPart(part.operation_code);

        for (const modelName of targetModels) {
            const modelId = modelMap.get(modelName);
            if (!modelId) continue;

            await prisma.modelPart.create({
                data: {
                    part_id: part.id,
                    model_id: modelId,
                    quantity_required: 1
                }
            });

            created++;
            stats[modelName] = (stats[modelName] || 0) + 1;
        }
    }

    console.log('\n✅ Model-Part links created:');
    for (const [model, count] of Object.entries(stats)) {
        console.log(`   ${model}: ${count} parça`);
    }
    console.log(`\n📊 Total links: ${created}`);

    await prisma.$disconnect();
}

linkPartsToModelsCorrectly();
