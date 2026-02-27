const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function extractImagesFromExcelByRow(excelPath, outputDir = 'extracted_images') {
    console.log(`\n🔍 Reading Excel file: ${excelPath}`);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    const worksheet = workbook.worksheets[0];
    console.log(`📊 Processing worksheet: ${worksheet.name}`);

    // First, find which column contains "PARÇA ADI" or similar headers
    let codeColumnIndex = null;
    const headerRow = worksheet.getRow(1);

    headerRow.eachCell((cell, colNumber) => {
        const headerValue = cell.value?.toString().toUpperCase() || '';
        if (headerValue.includes('PARÇA') || headerValue.includes('KOD') || headerValue === 'KOD') {
            codeColumnIndex = colNumber;
            console.log(`✓ Found code column at index ${colNumber}: "${cell.value}"`);
        }
    });

    if (!codeColumnIndex) {
        console.log('⚠️ Could not find code column, will try columns 1-3');
        codeColumnIndex = 1; // Default to first column
    }

    const imageMatches = [];
    let imageCount = 0;

    // Get all images and create a map of row -> image
    const imagesByRow = new Map();

    worksheet.getImages().forEach((image) => {
        const img = workbook.getImage(image.imageId);
        const range = image.range;
        const row = range.tl.nativeRow + 1; // Convert to 1-based

        if (!imagesByRow.has(row)) {
            imagesByRow.set(row, []);
        }
        imagesByRow.set(row, { img, range });
    });

    console.log(`\n📷 Found ${imagesByRow.size} images mapped to rows`);

    // Now iterate through rows and match images to codes
    for (const [rowNum, imageData] of imagesByRow.entries()) {
        try {
            const { img, range } = imageData;
            const extension = img.extension || 'png';

            // Look for code in current row, previous row, and next row
            const rowsToCheck = [rowNum, rowNum - 1, rowNum + 1];

            for (const checkRow of rowsToCheck) {
                if (operationCode) break;
                if (checkRow < 1 || checkRow > worksheet.rowCount) continue;

                const rowData = worksheet.getRow(checkRow);

                // Check first 10 columns
                for (let checkCol = 1; checkCol <= 10; checkCol++) {
                    const cell = rowData.getCell(checkCol);
                    let value = cell.value;

                    if (value && typeof value === 'object') {
                        if (value.text) value = value.text;
                        else if (value.richText) value = value.richText.map(r => r.text).join('');
                        else value = value.toString();
                    }

                    value = value ? value.toString().trim() : '';

                    // Look for specific code pattern or just any alphanumeric > 3 matching our typical codes
                    if (value.length > 3 && /[A-Z0-9]/.test(value) &&
                        (value.includes('-') || value.startsWith('BRG') || value.startsWith('TRG'))) {
                        operationCode = value;
                        console.log(`\n📷 ImageRow ${rowNum} -> Found code "${operationCode}" in Row ${checkRow}, Col ${checkCol}`);
                        break;
                    }
                }
            }

            if (!operationCode) {
                console.log(`\n⚠️  Row ${rowNum}: No operation code found in nearby rows, skipping`);
                continue;
            }

            // Generate filename from operation code
            const safeCode = operationCode.replace(/[^a-zA-Z0-9\-_]/g, '');
            const filename = `${safeCode}.${extension}`;

            // Save the image
            const outputPath = path.join(outputDir, filename);
            fs.writeFileSync(outputPath, img.buffer);

            imageCount++;
            console.log(`  💾 Saved as: ${filename}`);

            imageMatches.push({
                operationCode,
                imagePath: filename,
                row: rowNum
            });

        } catch (error) {
            console.error(`  ✗ Error processing row ${rowNum}:`, error.message);
        }
    }

    console.log(`\n✅ Extracted ${imageCount} images to '${outputDir}'`);
    console.log(`✅ Matched ${imageMatches.length} images to operation codes`);

    return imageMatches;
}

async function updatePartsWithImages(imageMatches, imageDir) {
    console.log(`\n🔄 Updating database with ${imageMatches.length} matched images...`);

    // Ensure uploads directory exists in the server
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const match of imageMatches) {
        try {
            // Clean the operation code for matching
            const cleanCode = match.operationCode.trim().toUpperCase();

            // Find the part in the database - try exact match first
            let part = await prisma.part.findFirst({
                where: {
                    operation_code: {
                        equals: cleanCode,
                        mode: 'insensitive'
                    }
                }
            });

            // If not found, try contains
            if (!part) {
                part = await prisma.part.findFirst({
                    where: {
                        operation_code: {
                            contains: cleanCode,
                            mode: 'insensitive'
                        }
                    }
                });
            }

            if (part) {
                // Copy image to uploads folder
                const sourcePath = path.join(imageDir, match.imagePath);
                const targetPath = path.join(uploadsDir, match.imagePath);

                // Only copy if source exists
                if (fs.existsSync(sourcePath)) {
                    fs.copyFileSync(sourcePath, targetPath);

                    // Update part with image URL
                    await prisma.part.update({
                        where: { id: part.id },
                        data: {
                            image_url: `/uploads/${match.imagePath}`
                        }
                    });

                    console.log(`  ✓ Updated: ${part.name} (${part.operation_code}) -> ${match.imagePath}`);
                    updatedCount++;
                } else {
                    console.log(`  ⚠️  Source image not found: ${sourcePath}`);
                }
            } else {
                console.log(`  ⚠️  No matching part found for code: ${match.operationCode}`);
                notFoundCount++;
            }
        } catch (error) {
            console.error(`  ✗ Error updating part ${match.operationCode}:`, error.message);
        }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} parts with images`);
    if (notFoundCount > 0) {
        console.log(`⚠️  ${notFoundCount} images could not be matched to parts in database`);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log('Usage: node src/importImagesFixed.js <path-to-excel-file> [output-directory]');
        console.log('Example: node src/importImagesFixed.js "D:\\\\Downloads\\\\Kitap2.xlsx"');
        process.exit(1);
    }

    const excelPath = args[0];
    const outputDir = args[1] || 'extracted_images';

    if (!fs.existsSync(excelPath)) {
        console.error(`❌ Error: File not found: ${excelPath}`);
        process.exit(1);
    }

    try {
        // Extract images from Excel
        const imageMatches = await extractImagesFromExcelByRow(excelPath, outputDir);

        // Update database with matched images
        if (imageMatches.length > 0) {
            await updatePartsWithImages(imageMatches, outputDir);
        } else {
            console.log('\n⚠️  No images were matched to operation codes.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

main();
