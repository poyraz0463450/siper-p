const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const xml2js = require('xml2js');
const ExcelJS = require('exceljs'); // Still use ExcelJS for reading cell data, which seemed to work

const prisma = new PrismaClient();

async function parseXml(filePath) {
    const parser = new xml2js.Parser();
    const content = fs.readFileSync(filePath);
    return await parser.parseStringPromise(content);
}

async function unzipAndImport(excelPath) {
    console.log(`\n🚀 Starting Advanced Image Import`);

    // 1. Unzip
    const tempDir = path.join(process.cwd(), 'temp_xlsx_extract');
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir);

    console.log(`📦 Unzipping ${excelPath} to ${tempDir}...`);
    try {
        const zip = new AdmZip(excelPath);
        zip.extractAllTo(tempDir, true);
    } catch (e) {
        console.error('❌ Failed to unzip file:', e.message);
        return;
    }

    // 2. Map Images (rIds)
    const drawingsDir = path.join(tempDir, 'xl', 'drawings');
    const relsDir = path.join(drawingsDir, '_rels');

    // Find drawing1.xml (assuming first sheet uses drawing1)
    if (!fs.existsSync(drawingsDir)) {
        console.error('❌ No drawings directory found. File might not contain images.');
        return;
    }

    const drawingFiles = fs.readdirSync(drawingsDir).filter(f => f.endsWith('.xml'));
    if (drawingFiles.length === 0) {
        console.error('❌ No drawing.xml found.');
        return;
    }

    const drawingFile = drawingFiles[0]; // usually drawing1.xml
    const relsFile = `${drawingFile}.rels`;

    const drawingPath = path.join(drawingsDir, drawingFile);
    const relsPath = path.join(relsDir, relsFile);

    console.log(`📖 Analyzing ${drawingFile}...`);

    // Parse Rels
    const relsData = await parseXml(relsPath);
    const rIdToFilename = new Map();
    if (relsData.Relationships && relsData.Relationships.Relationship) {
        relsData.Relationships.Relationship.forEach(rel => {
            const target = rel.$.Target;
            // target is often "../media/image1.png"
            const filename = path.basename(target);
            rIdToFilename.set(rel.$.Id, filename);
        });
    }

    // Parse Drawing Anchors
    const drawingData = await parseXml(drawingPath);
    const rowToImage = new Map();

    // Support different anchor types
    const wsDr = drawingData['xdr:wsDr'];
    const anchors = [
        ...(wsDr['xdr:twoCellAnchor'] || []),
        ...(wsDr['xdr:oneCellAnchor'] || [])
    ];

    anchors.forEach(anchor => {
        try {
            // Find Row Index (0-based in XML? usually)
            let row = 0;
            if (anchor['xdr:from']) {
                row = parseInt(anchor['xdr:from'][0]['xdr:row'][0]);
            } else {
                // absolute anchor? skip
                return;
            }

            // Find Embed ID
            const pic = anchor['xdr:pic'] && anchor['xdr:pic'][0];
            if (pic) {
                const blipFill = pic['xdr:blipFill'][0];
                const blip = blipFill['a:blip'][0];
                const embedId = blip.$['r:embed'];

                if (embedId && rIdToFilename.has(embedId)) {
                    // Convert row to 1-based for ExcelJS match
                    rowToImage.set(row + 1, rIdToFilename.get(embedId));
                }
            }
        } catch (e) {
            // ignore malformed anchor
        }
    });

    console.log(`✅ Found ${rowToImage.size} matched images in XML structure`);

    // 3. Read Excel Data for Codes
    console.log('📖 Reading Excel Data...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];

    // 4. Update Database
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    let updatedCount = 0;

    for (const [rowNum, filename] of rowToImage.entries()) {
        const row = worksheet.getRow(rowNum);

        // Search for code in this row
        let operationCode = null;
        for (let c = 1; c <= 5; c++) {
            const val = row.getCell(c).value;
            if (val) {
                const strVal = typeof val === 'object' ? (val.text || JSON.stringify(val)) : val.toString();
                if (strVal.length > 3 && /^([A-Z0-9]+(-[A-Z0-9]+)?)$/.test(strVal.trim())) {
                    operationCode = strVal.trim();
                    break;
                }
            }
        }

        if (operationCode) {
            console.log(`  Processing Row ${rowNum}: Code "${operationCode}"`);

            // Copy file
            const mediaSource = path.join(tempDir, 'xl', 'media', filename);
            const mediaTarget = path.join(uploadsDir, filename);

            if (fs.existsSync(mediaSource)) {
                fs.copyFileSync(mediaSource, mediaTarget);

                // Update DB
                const cleanCode = operationCode.trim();
                if (!cleanCode) continue;

                try {
                    let part = await prisma.part.findFirst({
                        where: { operation_code: { equals: cleanCode, mode: 'insensitive' } }
                    });

                    if (!part) {
                        part = await prisma.part.findFirst({
                            where: { operation_code: { contains: cleanCode, mode: 'insensitive' } }
                        });
                    }

                    if (part) {
                        await prisma.part.update({
                            where: { id: part.id },
                            data: { image_url: `/uploads/${filename}` }
                        });
                        console.log(`  ✓ Linked: ${cleanCode} -> ${filename}`);
                        updatedCount++;
                    } else {
                        console.log(`  ⚠️  Part not found for code: ${cleanCode}`);
                    }
                } catch (err) {
                    console.error(`  ✗ Prisma Error for code "${cleanCode}":`, err.message);
                }
            } else {
                console.log(`  ⚠️  Media file missing: ${filename}`);
            }
        }
    }

    console.log(`\n🎉 Process Complete. Updated ${updatedCount} parts.`);

    // Cleanup
    try {
        fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) { }
}

const targetFile = process.argv[2];
unzipAndImport(targetFile)
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
