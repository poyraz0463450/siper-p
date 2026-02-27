const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const xml2js = require('xml2js');

const prisma = new PrismaClient();

async function parseXml(filePath) {
    const parser = new xml2js.Parser();
    const content = fs.readFileSync(filePath);
    return await parser.parseStringPromise(content);
}

async function importImagesManual(excelPath, extractedDir) {
    console.log(`\n🔧 Manual Image Import from expanded XLSX`);
    console.log(`Excel: ${excelPath}`);
    console.log(`Extracted Dir: ${extractedDir}`);

    // paths to XML files
    const drawingXmlPath = path.join(extractedDir, 'xl', 'drawings', 'drawing1.xml');
    const relsXmlPath = path.join(extractedDir, 'xl', 'drawings', '_rels', 'drawing1.xml.rels');

    if (!fs.existsSync(drawingXmlPath) || !fs.existsSync(relsXmlPath)) {
        console.error('❌ XML files not found. Make sure you extracted the xlsx correctly.');
        return;
    }

    // 1. Map rIds to Filenames using .rels
    console.log('📖 Parsing rels...');
    const relsData = await parseXml(relsXmlPath);
    const rIdToFilename = new Map();

    const relationships = relsData.Relationships.Relationship;
    relationships.forEach(rel => {
        const id = rel.$.Id;
        const target = rel.$.Target; // e.g., "../media/image1.png"
        // Cleanup target path to get just filename
        const filename = path.basename(target);
        rIdToFilename.set(id, filename);
    });
    console.log(`  Mapped ${rIdToFilename.size} relationships`);

    // 2. Map Rows to rIds using drawing1.xml
    console.log('📖 Parsing drawing1.xml...');
    const drawingData = await parseXml(drawingXmlPath);
    const rowToImage = new Map();

    // Look for xdr:twoCellAnchor or xdr:oneCellAnchor
    // The structure depends on the file. Let's handle 'xdr:wsDr' root.
    const anchors = drawingData['xdr:wsDr']['xdr:twoCellAnchor'] || [];
    const oneCellAnchors = drawingData['xdr:wsDr']['xdr:oneCellAnchor'] || [];

    const allAnchors = [...anchors, ...oneCellAnchors];
    console.log(`  Found ${allAnchors.length} anchors`);

    allAnchors.forEach(anchor => {
        try {
            // Get Row. usually in xdr:from -> xdr:row
            const from = anchor['xdr:from'][0];
            const row = parseInt(from['xdr:row'][0]) + 1; // Convert to 1-based index

            // Get Embed ID. usually in xdr:pic -> xdr:blipFill -> a:blip -> r:embed
            if (anchor['xdr:pic']) {
                const pic = anchor['xdr:pic'][0];
                const blipFill = pic['xdr:blipFill'][0];
                const blip = blipFill['a:blip'][0];
                const embedId = blip.$['r:embed'];

                if (embedId && rIdToFilename.has(embedId)) {
                    const filename = rIdToFilename.get(embedId);
                    rowToImage.set(row, filename);
                    // console.log(`  Match: Row ${row} -> ${filename} (rId: ${embedId})`);
                }
            }
        } catch (e) {
            // console.warn('Skipping an anchor due to structure', e.message);
        }
    });

    console.log(`✅ Mapped ${rowToImage.size} images to rows`);

    // 3. Read Excel Data to match Codes to Rows
    console.log('📖 Reading Excel Data for Part Codes...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];

    let updatedCount = 0;

    // Iterate through all rows that have images
    for (const [rowNum, imageFilename] of rowToImage.entries()) {
        try {
            // Check finding code in the row
            let operationCode = null;
            const row = worksheet.getRow(rowNum);

            // Search first 5 columns
            for (let c = 1; c <= 5; c++) {
                const val = row.getCell(c).value;
                if (val && val.toString().length > 3 && (val.toString().includes('-') || /[A-Z0-9]/.test(val.toString()))) {
                    operationCode = val.toString().trim();
                    break;
                }
            }

            if (operationCode) {
                // Match to DB
                // console.log(`  Row ${rowNum}: Code "${operationCode}" -> Image "${imageFilename}"`);

                // --- DB UPDATE logic ---

                // Ensure uploads dir
                const mediaPath = path.join(extractedDir, 'xl', 'media', imageFilename);
                const targetPath = path.join('uploads', imageFilename);

                if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

                if (fs.existsSync(mediaPath)) {
                    fs.copyFileSync(mediaPath, targetPath);

                    // Cleanup code (remove quotes if any)
                    const cleanCode = operationCode.replace(/['"]/g, '');

                    // Find part
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
                            data: { image_url: `/uploads/${imageFilename}` }
                        });
                        console.log(`  ✓ Updated DB: ${cleanCode} -> ${imageFilename}`);
                        updatedCount++;
                    } else {
                        // console.log(`  ⚠️ Code not found in DB: ${cleanCode}`);
                    }
                }

            } else {
                // console.log(`  Row ${rowNum}: Has image but no Code found`);
            }
        } catch (e) {
            console.error(`Error processing row ${rowNum}`, e);
        }
    }

    console.log(`\n🎉 DONE! Updated ${updatedCount} parts.`);
}

// Check args
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node src/importImagesManual.js <excel-file> <extracted-dir>');
    process.exit(1);
}

importImagesManual(args[0], args[1])
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
