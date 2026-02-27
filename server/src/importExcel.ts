import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importFromExcel() {
    console.log('📊 Starting Excel import from Kitap2.xlsx...');

    const xlsxPath = path.join(__dirname, '../Kitap2.xlsx');
    const workbook = new ExcelJS.Workbook();

    try {
        await workbook.xlsx.readFile(xlsxPath);
        console.log('✅ Excel file loaded successfully');
    } catch (e) {
        console.error('❌ Error loading Excel file:', e);
        return;
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        console.error('No worksheet found!');
        return;
    }

    console.log(`Found worksheet: ${worksheet.name}`);
    console.log(`Rows: ${worksheet.rowCount}`);

    // Determine column mapping from header row
    const headerRow = worksheet.getRow(1);
    const columns: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
        const value = cell.value?.toString().toLowerCase().trim() || '';
        if (value.includes('parça') || value.includes('ad')) columns['name'] = colNumber;
        if (value.includes('malzeme')) columns['material'] = colNumber;
        if (value.includes('ısıl') || value.includes('isil')) columns['heat_treatment'] = colNumber;
        if (value.includes('kaplama')) columns['coating'] = colNumber;
        if (value.includes('operasyon') || value.includes('kod')) columns['operation_code'] = colNumber;
        if (value.includes('stok') || value.includes('adet')) columns['stock'] = colNumber;
    });

    console.log('Column mapping:', columns);

    let imported = 0;
    let skipped = 0;

    // Import each row
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);

        const name = row.getCell(columns['name'] || 1).value?.toString().trim();
        if (!name || name.length < 2) {
            skipped++;
            continue;
        }

        const partData = {
            name: name,
            material: row.getCell(columns['material'] || 2).value?.toString().trim() || null,
            heat_treatment: row.getCell(columns['heat_treatment'] || 3).value?.toString().trim() || null,
            coating: row.getCell(columns['coating'] || 4).value?.toString().trim() || null,
            operation_code: row.getCell(columns['operation_code'] || 5).value?.toString().trim() || null,
            stock_quantity: parseInt(row.getCell(columns['stock'] || 6).value?.toString() || '0') || 0,
            min_stock_level: 5,
            average_cost: 50 + Math.random() * 200,
        };

        try {
            await prisma.part.create({
                data: partData as any
            });
            imported++;
            if (imported % 10 === 0) {
                console.log(`  Imported ${imported} parts...`);
            }
        } catch (e: any) {
            if (e.code === 'P2002') {
                // Duplicate, update instead
                await prisma.part.updateMany({
                    where: { name: partData.name },
                    data: partData as any
                });
            } else {
                console.error(`Error importing ${name}:`, e.message);
            }
        }
    }

    console.log(`✅ Import complete! Imported: ${imported}, Skipped: ${skipped}`);
}

async function importFromExtractedXML() {
    console.log('📄 Importing from extracted XML files...');

    const xml2js = require('xml2js');
    const sharedStringsPath = path.join(__dirname, '../extracted_kitap2/xl/sharedStrings.xml');
    const sheetPath = path.join(__dirname, '../extracted_kitap2/xl/worksheets/sheet1.xml');

    // Read shared strings
    const sharedStringsXml = fs.readFileSync(sharedStringsPath, 'utf-8');
    const sharedStrings: string[] = [];

    const parser = new xml2js.Parser();
    const ssResult = await parser.parseStringPromise(sharedStringsXml);

    if (ssResult.sst && ssResult.sst.si) {
        for (const si of ssResult.sst.si) {
            if (si.t) {
                sharedStrings.push(si.t[0] || '');
            } else if (si.r) {
                // Rich text
                let text = '';
                for (const r of si.r) {
                    if (r.t) text += r.t[0] || '';
                }
                sharedStrings.push(text);
            }
        }
    }

    console.log(`Found ${sharedStrings.length} shared strings`);

    // Read sheet data
    const sheetXml = fs.readFileSync(sheetPath, 'utf-8');
    const sheetResult = await parser.parseStringPromise(sheetXml);

    const rows = sheetResult.worksheet.sheetData[0].row || [];
    console.log(`Found ${rows.length} rows`);

    // First row is header
    let imported = 0;.
    

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.c || [];

        const getCellValue = (cellIndex: number): string => {
            const cell = cells.find((c: any) => {
                const ref = c.$.r || '';
                const col = ref.replace(/[0-9]/g, '');
                return col.charCodeAt(0) - 65 === cellIndex;
            });

            if (!cell) return '';

            if (cell.$.t === 's') {
                // Shared string reference
                const idx = parseInt(cell.v?.[0] || '0');
                return sharedStrings[idx] || '';
            }
            return cell.v?.[0] || '';
        };

        const name = getCellValue(0); // Column A
        if (!name || name.length < 2) continue;

        try {
            await prisma.part.create({
                data: {
                    name: name,
                    material: getCellValue(1) || null,
                    heat_treatment: getCellValue(2) || null,
                    coating: getCellValue(3) || null,
                    operation_code: getCellValue(4) || null,
                    stock_quantity: parseInt(getCellValue(5)) || 0,
                    min_stock_level: 5,
                    average_cost: 50 + Math.random() * 200,
                }
            });
            imported++;
        } catch (e: any) {
            // Skip duplicates
        }
    }

    console.log(`✅ XML Import complete! Imported: ${imported} parts`);
}

// Clear existing parts first
async function main() {
    console.log('🗑️ Clearing existing sample parts...');
    await prisma.modelPart.deleteMany({});
    await prisma.partSupplier.deleteMany({});
    await prisma.stockReservation.deleteMany({});
    await prisma.purchaseRequest.deleteMany({});
    await prisma.part.deleteMany({});

    await importFromExcel();

    // Link parts to models
    console.log('🔗 Linking parts to models...');
    const allParts = await prisma.part.findMany();
    const allModels = await prisma.model.findMany();

    for (const model of allModels) {
        for (const part of allParts) {
            try {
                await prisma.modelPart.create({
                    data: {
                        part_id: part.id,
                        model_id: model.id,
                        quantity_required: 1
                    }
                });
            } catch (e) {
                // Skip if exists
            }
        }
    }

    console.log('🎉 All done!');
    await prisma.$disconnect();
}

main().catch(console.error);
