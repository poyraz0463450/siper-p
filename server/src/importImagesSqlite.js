const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const xml2js = require('xml2js');
const ExcelJS = require('exceljs');

const prisma = new PrismaClient();

async function parseXml(filePath) {
    const parser = new xml2js.Parser();
    const content = fs.readFileSync(filePath);
    return await parser.parseStringPromise(content);
}

async function importImages(excelPath) {
    console.log(`\n🚀 Starting Image Import (SQLite Compatible)`);

    // 1. Unzip
    const tempDir = path.join(process.cwd(), 'temp_xlsx_extract');
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir);

    try {
        const zip = new AdmZip(excelPath);
        zip.extractAllTo(tempDir, true);
        console.log('📦 Unzipped successfully');
    } catch (e) {
        console.error('❌ Failed to unzip:', e.message);
        return;
    }

    // 2. Get Images and their Row positions from XML
    const drawingDir = path.join(tempDir, 'xl', 'drawings');
    const relsDir = path.join(drawingDir, '_rels');

    if (!fs.existsSync(drawingDir)) {
        console.error('❌ No drawings directory found.');
        return;
    }

    const drawingFile = fs.readdirSync(drawingDir).filter(f => f.endsWith('.xml'))[0];
    if (!drawingFile) { console.error('❌ No drawing XML found'); return; }

    const relsFile = `${drawingFile}.rels`;
    const relsPath = path.join(relsDir, relsFile);

    if (!fs.existsSync(relsPath)) { console.error('❌ No rels file found'); return; }

    // Map rId -> Filename
    const relsData = await parseXml(relsPath);
    const rIdToFilename = new Map();
    relsData.Relationships.Relationship.forEach(rel => {
        rIdToFilename.set(rel.$.Id, path.basename(rel.$.Target));
    });
    console.log(`📎 Found ${rIdToFilename.size} image references`);

    // Parse Anchors to map rows to images
    const drawingData = await parseXml(path.join(drawingDir, drawingFile));
    const wsDr = drawingData['xdr:wsDr'];
    const anchors = [...(wsDr['xdr:twoCellAnchor'] || []), ...(wsDr['xdr:oneCellAnchor'] || [])];

    const rowToImage = new Map();
    anchors.forEach(anchor => {
        try {
            const row = parseInt(anchor['xdr:from'][0]['xdr:row'][0]) + 1; // Convert to 1-based
            const pic = anchor['xdr:pic'] && anchor['xdr:pic'][0];
            if (pic) {
                const embedId = pic['xdr:blipFill'][0]['a:blip'][0].$['r:embed'];
                if (embedId && rIdToFilename.has(embedId)) {
                    rowToImage.set(row, rIdToFilename.get(embedId));
                }
            }
        } catch (e) { }
    });
    console.log(`🖼️  Mapped ${rowToImage.size} images to rows`);

    // 3. Read Excel Data for Codes
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];
    console.log(`📊 Reading worksheet: ${worksheet.name}`);

    // 4. Get ALL parts from database for matching
    const allParts = await prisma.part.findMany();
    console.log(`📦 Loaded ${allParts.length} parts from database`);

    // Create lookup map (lowercase code -> part)
    const codeToPartMap = new Map();
    allParts.forEach(p => {
        if (p.operation_code) {
            codeToPartMap.set(p.operation_code.toLowerCase().trim(), p);
        }
    });

    // 5. Process each row with image
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const [rowNum, filename] of rowToImage.entries()) {
        const row = worksheet.getRow(rowNum);

        // Find code in first 5 columns
        let operationCode = null;
        for (let c = 1; c <= 5; c++) {
            let val = row.getCell(c).value;
            if (val) {
                if (typeof val === 'object') {
                    if (val.text) val = val.text;
                    else if (val.richText) val = val.richText.map(r => r.text).join('');
                    else continue;
                }
                const strVal = val.toString().trim();
                // Match typical code patterns like BRG9001-C, TRG1234, etc.
                if (strVal.length > 3 && /^[A-Z0-9]/.test(strVal)) {
                    operationCode = strVal;
                    break;
                }
            }
        }

        if (operationCode) {
            // Copy image file
            const src = path.join(tempDir, 'xl', 'media', filename);
            const dst = path.join(uploadsDir, filename);
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, dst);
            }

            // Find part in our map (case-insensitive)
            const part = codeToPartMap.get(operationCode.toLowerCase().trim());

            if (part) {
                try {
                    await prisma.part.update({
                        where: { id: part.id },
                        data: { image_url: `/uploads/${filename}` }
                    });
                    console.log(`✅ ${operationCode} -> ${filename}`);
                    updatedCount++;
                } catch (e) {
                    console.error(`❌ Update failed for ${operationCode}: ${e.message}`);
                }
            } else {
                console.log(`⚠️  Part not found: ${operationCode}`);
                notFoundCount++;
            }
        }
    }

    console.log(`\n🎉 Done! Updated: ${updatedCount}, Not Found: ${notFoundCount}`);

    // Cleanup
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) { }
}

importImages(process.argv[2])
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
