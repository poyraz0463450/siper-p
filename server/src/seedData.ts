import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting comprehensive seed...');

    // 1. Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const user = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            password_hash: hashedPassword,
            role: 'admin',
        },
    });
    console.log('✅ Admin user ready:', user.username);

    // 2. Create suppliers
    const suppliers = [
        { name: 'Çelik A.Ş.', contact: 'Ahmet Yılmaz', phone: '0212-555-1234', email: 'ahmet@celikas.com' },
        { name: 'Metal Works', contact: 'Mehmet Demir', phone: '0216-444-5678', email: 'mehmet@metalworks.com' },
        { name: 'Kaplama Ltd.', contact: 'Ayşe Kara', phone: '0212-333-9012', email: 'ayse@kaplama.com' },
    ];

    for (const sup of suppliers) {
        await prisma.supplier.upsert({
            where: { id: suppliers.indexOf(sup) + 1 },
            update: {},
            create: sup,
        });
    }
    console.log('✅ Suppliers seeded');

    // 3. Create sample parts
    const sampleParts = [
        { name: 'Ana Gövde', material: 'Alüminyum 7075', heat_treatment: 'T6', coating: 'Eloksal', operation_code: 'AG-001', stock_quantity: 50, min_stock_level: 10, average_cost: 150 },
        { name: 'Tetik Mekanizması', material: 'Çelik 4140', heat_treatment: 'Sertleştirme', coating: 'Fosfat', operation_code: 'TM-002', stock_quantity: 30, min_stock_level: 5, average_cost: 85 },
        { name: 'Namlu', material: 'Çelik 4150', heat_treatment: 'Sertleştirme', coating: 'Krom', operation_code: 'NM-003', stock_quantity: 25, min_stock_level: 5, average_cost: 320 },
        { name: 'Sürgü', material: 'Çelik 4140', heat_treatment: 'Sertleştirme', coating: 'Nikel', operation_code: 'SG-004', stock_quantity: 40, min_stock_level: 8, average_cost: 180 },
        { name: 'Şarjör', material: 'Alüminyum 6061', heat_treatment: 'T6', coating: 'Anotize', operation_code: 'SJ-005', stock_quantity: 100, min_stock_level: 20, average_cost: 45 },
        { name: 'Yay Seti', material: 'Çelik Yay', heat_treatment: 'Temperlenmiş', coating: null, operation_code: 'YS-006', stock_quantity: 200, min_stock_level: 30, average_cost: 12 },
        { name: 'Kundak', material: 'Polimer', heat_treatment: null, coating: null, operation_code: 'KU-007', stock_quantity: 60, min_stock_level: 10, average_cost: 65 },
        { name: 'Kabza', material: 'Polimer', heat_treatment: null, coating: null, operation_code: 'KB-008', stock_quantity: 80, min_stock_level: 15, average_cost: 35 },
        { name: 'Nişangah Ön', material: 'Çelik', heat_treatment: null, coating: 'Siyah Oksit', operation_code: 'NO-009', stock_quantity: 120, min_stock_level: 20, average_cost: 18 },
        { name: 'Nişangah Arka', material: 'Çelik', heat_treatment: null, coating: 'Siyah Oksit', operation_code: 'NA-010', stock_quantity: 120, min_stock_level: 20, average_cost: 22 },
        { name: 'Emniyet Mandalı', material: 'Çelik 4140', heat_treatment: 'Sertleştirme', coating: 'Fosfat', operation_code: 'EM-011', stock_quantity: 90, min_stock_level: 15, average_cost: 28 },
        { name: 'İğne', material: 'Çelik Alaşım', heat_treatment: 'Sertleştirme', coating: null, operation_code: 'IG-012', stock_quantity: 150, min_stock_level: 25, average_cost: 15 },
        { name: 'Ejektör', material: 'Çelik', heat_treatment: 'Sertleştirme', coating: null, operation_code: 'EJ-013', stock_quantity: 100, min_stock_level: 20, average_cost: 20 },
        { name: 'Extraktör', material: 'Çelik', heat_treatment: 'Sertleştirme', coating: null, operation_code: 'EX-014', stock_quantity: 100, min_stock_level: 20, average_cost: 25 },
        { name: 'Horoz', material: 'Çelik 4140', heat_treatment: 'Sertleştirme', coating: 'Fosfat', operation_code: 'HR-015', stock_quantity: 70, min_stock_level: 10, average_cost: 55 },
    ];

    for (const part of sampleParts) {
        await prisma.part.upsert({
            where: { id: sampleParts.indexOf(part) + 1 },
            update: part,
            create: part,
        });
    }
    console.log(`✅ ${sampleParts.length} parts seeded`);

    // 4. Create models
    const modelDefinitions = [
        { name: 'GEN1', description: 'Birinci Nesil Model' },
        { name: 'GEN2', description: 'İkinci Nesil Model' },
        { name: 'TACTİCAL', description: 'Taktik Model' },
        { name: 'FD', description: 'FD Model' },
        { name: 'FDX', description: 'FDX Premium Model' }
    ];

    const createdModels: any[] = [];
    for (const def of modelDefinitions) {
        const model = await prisma.model.upsert({
            where: { name: def.name },
            update: {},
            create: def,
        });
        createdModels.push(model);
    }
    console.log('✅ Models seeded');

    // 5. Link parts to models (simplified: all parts to all models)
    const allParts = await prisma.part.findMany();
    for (const model of createdModels) {
        for (const part of allParts) {
            const existing = await prisma.modelPart.findUnique({
                where: {
                    part_id_model_id: {
                        part_id: part.id,
                        model_id: model.id
                    }
                }
            });
            if (!existing) {
                await prisma.modelPart.create({
                    data: {
                        part_id: part.id,
                        model_id: model.id,
                        quantity_required: 1
                    }
                });
            }
        }
    }
    console.log('✅ Model-Part links created');

    // 6. Link parts to suppliers
    const allSuppliers = await prisma.supplier.findMany();
    for (const part of allParts) {
        const supplier = allSuppliers[part.id % allSuppliers.length];
        const existing = await prisma.partSupplier.findUnique({
            where: {
                part_id_supplier_id: {
                    part_id: part.id,
                    supplier_id: supplier.id
                }
            }
        });
        if (!existing) {
            await prisma.partSupplier.create({
                data: {
                    part_id: part.id,
                    supplier_id: supplier.id,
                    price: part.average_cost * 1.2,
                    is_primary: true,
                    lead_time_days: 3 + (part.id % 5)
                }
            });
        }
    }
    console.log('✅ Part-Supplier links created');

    console.log('🎉 Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
