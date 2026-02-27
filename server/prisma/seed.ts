import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // 1. Create Parts
    console.log('Creating parts...');
    const partsData = [
        { name: 'Ana Gövde', material: 'Alüminyum 6061', heat_treatment: 'T6', coating: 'Anotlama', operation_code: 'CNC-001', stock_quantity: 50, min_stock_level: 10, average_cost: 150 },
        { name: 'Kapak', material: 'Paslanmaz Çelik 304', heat_treatment: null, coating: 'Parlatma', operation_code: 'CNC-002', stock_quantity: 30, min_stock_level: 5, average_cost: 80 },
        { name: 'Mil', material: 'Çelik 4140', heat_treatment: 'Sertleştirme', coating: 'Krom Kaplama', operation_code: 'TORNA-001', stock_quantity: 100, min_stock_level: 20, average_cost: 45 },
        { name: 'Rulman Yatağı', material: 'Bronz', heat_treatment: null, coating: null, operation_code: 'FREZE-001', stock_quantity: 75, min_stock_level: 15, average_cost: 60 },
        { name: 'Conta', material: 'NBR Kauçuk', heat_treatment: null, coating: null, operation_code: 'KESIM-001', stock_quantity: 200, min_stock_level: 50, average_cost: 5 },
        { name: 'Civata M8x25', material: 'Çelik 8.8', heat_treatment: 'Galvaniz', coating: null, operation_code: 'STOK', stock_quantity: 500, min_stock_level: 100, average_cost: 2 },
        { name: 'Vida M4x10', material: 'Paslanmaz Çelik', heat_treatment: null, coating: null, operation_code: 'STOK', stock_quantity: 1000, min_stock_level: 200, average_cost: 0.5 },
        { name: 'Yay', material: 'Yay Çeliği', heat_treatment: 'Temperleme', coating: 'Fosfatlama', operation_code: 'FORM-001', stock_quantity: 150, min_stock_level: 30, average_cost: 12 },
        { name: 'Pim Ø6x30', material: 'Çelik', heat_treatment: 'Sertleştirme', coating: null, operation_code: 'TAŞLAMA-001', stock_quantity: 80, min_stock_level: 20, average_cost: 8 },
        { name: 'Elektrik Motoru', material: null, heat_treatment: null, coating: null, operation_code: 'MONTAJ', stock_quantity: 20, min_stock_level: 5, average_cost: 350 },
    ];

    for (const p of partsData) {
        await prisma.part.create({ data: p });
    }
    console.log(`✅ ${partsData.length} parts created.`);

    // 2. Create Suppliers
    console.log('Creating suppliers...');
    const suppliersData = [
        { name: 'Metal İşleme Ltd.', contact: 'Ahmet Yılmaz', phone: '05551112233', email: 'info@metalisleme.com' },
        { name: 'Kaplama Dünyası A.Ş.', contact: 'Mehmet Demir', phone: '05324445566', email: 'satis@kaplama.com' },
        { name: 'Hammadde Tedarikçisi', contact: 'Ayşe Kaya', phone: '02123334455', email: 'siparis@hammadde.com' },
    ];

    for (const s of suppliersData) {
        await prisma.supplier.create({ data: s });
    }
    console.log(`✅ ${suppliersData.length} suppliers created.`);

    // 3. Link parts to suppliers
    console.log('Linking parts to suppliers...');
    const parts = await prisma.part.findMany();
    const suppliers = await prisma.supplier.findMany();

    for (const part of parts) {
        const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
        await prisma.partSupplier.create({
            data: {
                part_id: part.id,
                supplier_id: supplier.id,
                price: part.average_cost * (1 + Math.random() * 0.2), // Slightly higher than avg cost
                is_primary: true,
                lead_time_days: Math.floor(Math.random() * 7) + 1 // 1-7 days
            }
        });
    }
    console.log('✅ Parts linked to suppliers.');

    // 4. Create Models
    console.log('Creating models...');
    const modelsData = [
        { name: 'GEN1', description: 'Genel amaçlı pompa modeli' },
        { name: 'GEN2', description: 'Yüksek basınç pompası' },
        { name: 'HIDRO-X', description: 'Hidrolik sistem ünitesi' },
        { name: 'KOMPAK', description: 'Kompakt pompa çözümü' },
        { name: 'ENDÜSTRI-PRO', description: 'Endüstriyel seri' },
    ];

    for (const m of modelsData) {
        await prisma.model.create({ data: m });
    }
    console.log(`✅ ${modelsData.length} models created.`);

    // 5. Link parts to models (ModelPart)
    console.log('Linking parts to models...');
    const models = await prisma.model.findMany();
    const allParts = await prisma.part.findMany();

    for (const model of models) {
        // Each model uses 5-8 random parts
        const numParts = Math.floor(Math.random() * 4) + 5;
        const shuffled = allParts.sort(() => 0.5 - Math.random());
        const selectedParts = shuffled.slice(0, numParts);

        for (const part of selectedParts) {
            await prisma.modelPart.create({
                data: {
                    model_id: model.id,
                    part_id: part.id,
                    quantity_required: Math.floor(Math.random() * 5) + 1 // 1-5 units
                }
            });
        }
    }
    console.log('✅ Parts linked to models.');

    // 6. Create sample Production Orders
    console.log('Creating production orders...');
    const statuses = ['planned', 'pending_approval', 'in_progress', 'quality_check', 'completed'];
    const priorities = ['low', 'normal', 'high', 'urgent'];
    const year = new Date().getFullYear();

    for (let i = 1; i <= 8; i++) {
        const model = models[Math.floor(Math.random() * models.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];

        await prisma.productionOrder.create({
            data: {
                order_code: `UE-${year}-${String(i).padStart(4, '0')}`,
                model_id: model.id,
                quantity: Math.floor(Math.random() * 20) + 5, // 5-25 units
                priority,
                status,
                notes: i % 3 === 0 ? 'Acil müşteri siparişi' : null,
                due_date: new Date(Date.now() + (Math.random() * 14 + 3) * 24 * 60 * 60 * 1000), // 3-17 days from now
            }
        });
    }
    console.log('✅ 8 production orders created.');

    console.log('🎉 Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
