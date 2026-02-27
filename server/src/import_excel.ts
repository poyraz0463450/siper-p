import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const filePath = "D:\\Downloads\\deneme1 .xlsx";

// Image mapping configuration
const imageMap: Record<string, string> = {
    'NAMLU': 'barrel_part_1768981401113.png',
    'TETİK': 'trigger_part_1768981461831.png',
    'YAY': 'spring_part_1768981500343.png',
    'ŞARJÖR': 'magazine_part_1768981543306.png',
    'MEKANİZMA': 'mechanism_part_1768981590202.png',
    'KİLİT': 'mechanism_part_1768981590202.png',
    'SÖKME': 'mechanism_part_1768981590202.png',
    'PİM': 'pin_part_1768981627430.png',
    'VİDA': 'pin_part_1768981627430.png',
    'SOMUN': 'pin_part_1768981627430.png'
};

const defaultImage = 'mechanism_part_1768981590202.png';

async function main() {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        console.log(`Found ${data.length} rows. Starting import...`);

        let count = 0;
        for (const row of data) {
            // Assuming Row format: [OperationCode, Name, ...]
            const opCode = row[0] ? String(row[0]).trim() : null;
            const name = row[1] ? String(row[1]).trim() : null;

            if (!opCode || !name) continue;

            // Determine Image
            let selectedImage = defaultImage;
            const upperName = name.toUpperCase();

            for (const [key, img] of Object.entries(imageMap)) {
                if (upperName.includes(key)) {
                    selectedImage = img;
                    break;
                }
            }

            const imageUrl = `/assets/parts/${selectedImage}`;

            // Upsert Part
            // Since schema doesn't have unique constraint on operation_code or name (except ID),
            // we'll check existence by operation_code first manually, or just create.
            // Wait, operation_code is not unique in schema? Let's check schema.
            // Schema: operation_code String? (Not unique).
            // Ideally we should update if exists. Since we don't have a unique key other than ID,
            // We will look up by operation_code.

            const existing = await prisma.part.findFirst({
                where: { operation_code: opCode }
            });

            if (existing) {
                // Update
                await prisma.part.update({
                    where: { id: existing.id },
                    data: {
                        name: name,
                        image_url: imageUrl,
                        // Don't overwrite stock if exists, or update? User said "design according to it", 
                        // implies this IS the master list. Let's keep existing stock or set random if 0.
                    }
                });
            } else {
                // Create
                await prisma.part.create({
                    data: {
                        name: name,
                        operation_code: opCode,
                        material: 'Çelik 4140', // Default
                        stock_quantity: Math.floor(Math.random() * 450) + 50, // 50-500
                        min_stock_level: 20,
                        image_url: imageUrl
                    }
                });
                count++;
            }
        }

        console.log(`Import completed. Added ${count} new parts.`);

    } catch (error) {
        console.error('Import failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
