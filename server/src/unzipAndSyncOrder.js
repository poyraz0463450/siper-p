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

async function unzipAndSyncByOrder(excelPath) {
    console.log(`\n🚀 Starting Sequential Image Import`);

    // 1. Unzip
    const tempDir = path.join(process.cwd(), 'temp_xlsx_seq');
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir);

    try {
        const zip = new AdmZip(excelPath);
        zip.extractAllTo(tempDir, true);
    } catch (e) {
        console.error('❌ Failed to unzip:', e.message);
        return;
    }

    // 2. Get Images and their Row positions
    const drawingDir = path.join(tempDir, 'xl', 'drawings');
    const relsDir = path.join(drawingDir, '_rels');

    if (!fs.existsSync(drawingDir)) { console.error('No drawings found'); return; }

    const drawingFile = fs.readdirSync(drawingDir).filter(f => f.endsWith('.xml'))[0];
    const relsFile = `${drawingFile}.rels`;

    // Map rId -> Filename
    const relsData = await parseXml(path.join(relsDir, relsFile));
    const rIdToFilename = new Map();
    relsData.Relationships.Relationship.forEach(rel => {
        rIdToFilename.set(rel.$.Id, path.basename(rel.$.Target));
    });

    // Parse Anchors to get Row Positions
    const drawingData = await parseXml(path.join(drawingDir, drawingFile));
    const wsDr = drawingData['xdr:wsDr'];
    const anchors = [...(wsDr['xdr:twoCellAnchor'] || []), ...(wsDr['xdr:oneCellAnchor'] || [])];

    const imageList = []; // { row: number, filename: string }

    anchors.forEach(anchor => {
        try {
            const row = parseInt(anchor['xdr:from'][0]['xdr:row'][0]);

            const pic = anchor['xdr:pic'] && anchor['xdr:pic'][0];
            if (pic) {
                const embedId = pic['xdr:blipFill'][0]['a:blip'][0].$['r:embed'];
                if (embedId && rIdToFilename.has(embedId)) {
                    imageList.push({
                        row: row, // Keep 0-based for sorting
                        filename: rIdToFilename.get(embedId)
                    });
                }
            }
        } catch (e) { }
    });

    // Sort images by row
    imageList.sort((a, b) => a.row - b.row);
    console.log(`📸 Found ${imageList.length} images.`);

    // 3. Get Codes from Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];

    const codeList = []; // { row: number, code: string }

    worksheet.eachRow((row, rowNumber) => {
        // Check first 5 columns for a code
        let code = null;
        for (let c = 1; c <= 5; c++) {
            const val = row.getCell(c).value;
            if (val) {
                const s = val.toString().trim();
                if (s.length > 3 && (s.includes('-') || /^[A-Z0-9]+$/.test(s))) {
                    code = s;
                    break;
                }
            }
        }
        if (code) {
            codeList.push({ row: rowNumber - 1, code: code }); // Use 0-based to match XML
        }
    });

    console.log(`📝 Found ${codeList.length} potential codes.`);

    // 4. Match and Update
    // Strategy: For each image, find the CLOSEST code (same row, or within 1 row)
    // Or if counts are identical, map 1-to-1?
    // Let's rely on "Same Row" first.

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    let updatedCount = 0;

    for (const img of imageList) {
        // Find code on the same row (allowing +/- 1 tolerance)
        const matchedCode = codeList.find(c => Math.abs(c.row - img.row) <= 1);

        if (matchedCode) {
            const filename = img.filename;
            const cleanCode = matchedCode.code;

            console.log(`  🔗 Matching: Row ${img.row} (Img) ~ Row ${matchedCode.row} (Code) -> ${cleanCode} : ${filename}`);

            // Copy File
            const src = path.join(tempDir, 'xl', 'media', filename);
            const dst = path.join(uploadsDir, filename);
            if (fs.existsSync(src)) fs.copyFileSync(src, dst);

            // Update DB
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
                    updatedCount++;
                } else {
                    console.log(`    ⚠️ Part not in DB: ${cleanCode}`);
                }
            } catch (e) {
                console.error(`    ❌ DB Error: ${e.message}`);
            }
        } else {
            console.log(`  ⚠️ Image at Row ${img.row} has no matching code nearby.`);
        }
    }

    console.log(`\n✅ Updated ${updatedCount} parts successfully.`);

    // Cleanup
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) { }
}

unzipAndSyncByOrder(process.argv[2])
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
