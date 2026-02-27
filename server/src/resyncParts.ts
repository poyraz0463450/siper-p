import { PrismaClient } from '@prisma/client';
import { syncPartModels } from './services/partService';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Sychronizing all parts...');

    // Fetch all parts
    const allParts = await prisma.part.findMany();
    console.log(`Found ${allParts.length} parts.`);

    let count = 0;
    for (const part of allParts) {
        if (part.operation_code) {
            await syncPartModels(part.id, part.operation_code);
            count++;
            if (count % 10 === 0) process.stdout.write('.');
        }
    }

    console.log('\n✅ Sync complete.');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
