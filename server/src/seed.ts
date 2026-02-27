import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
    errorFormat: 'pretty'
});

async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    try {
        // Seed admin user
        const user = await prisma.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                username: 'admin',
                password_hash: hashedPassword,
                role: 'admin',
            },
        });
        console.log('Admin user created:', user);

        // Seed models
        const modelDefinitions = [
            { name: 'GEN1', char: 'C' },
            { name: 'GEN2', char: 'K' },
            { name: 'TACTİCAL', char: 'L' },
            { name: 'FD', char: 'M' },
            { name: 'FDX', char: 'P' }
        ];

        // Create models first
        const dbModels: any = {};
        for (const def of modelDefinitions) {
            const model = await prisma.model.upsert({
                where: { name: def.name },
                update: {},
                create: {
                    name: def.name,
                    description: `${def.name} model`,
                },
            });
            dbModels[def.name] = model;
            console.log('Model ready:', model.name);
        }

        // Fetch all parts
        const allParts = await prisma.part.findMany();
        console.log(`Processing ${allParts.length} parts for linking...`);

        const charToModelName: Record<string, string> = {
            'C': 'GEN1',
            'K': 'GEN2',
            'L': 'TACTİCAL',
            'M': 'FD',
            'P': 'FDX'
        };

        for (const part of allParts) {
            let targetModelNames: string[] = [];

            // Check if part has a suffix
            if (part.operation_code && part.operation_code.includes('-')) {
                const parts = part.operation_code.split('-');
                const suffix = parts[parts.length - 1].toUpperCase();

                // Parse suffix characters
                for (const char of suffix) {
                    if (charToModelName[char]) {
                        targetModelNames.push(charToModelName[char]);
                    }
                }
            } else {
                // NO HYPHEN/SUFFIX -> "ALL" PARTS -> Link to ALL models
                targetModelNames = modelDefinitions.map(m => m.name);
            }

            // Link part to identified models
            for (const modelName of targetModelNames) {
                const model = dbModels[modelName];
                if (model) {
                    // Check if already linked to avoid unique constraint errors
                    const existing = await prisma.modelPart.findUnique({
                        where: {
                            part_id_model_id: {
                                model_id: model.id,
                                part_id: part.id
                            }
                        }
                    });

                    if (!existing) {
                        await prisma.modelPart.create({
                            data: {
                                model_id: model.id,
                                part_id: part.id,
                                quantity_required: 1
                            }
                        });
                        // console.log(`Linked ${part.name} to ${modelName}`);
                    }
                }
            }
        }
        console.log(`✅ Part linking complete.`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
