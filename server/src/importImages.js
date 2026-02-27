const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function extractImagesFromExcel(excelPath, outputDir = 'extracted_images') {
    console.log(`\n🔍 Reading Excel file: ${excelPath}`);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    const worksheet = workbook.worksheets[0];
    console.log(`📊 Processing worksheet: ${worksheet.name}`);

    const imageMatches = [];
    let imageCount = 0;

    // Iterate through all images in the worksheet
    worksheet.getImages().forEach((image) => {
        try {
            const img = workbook.getImage(image.imageId);
            const extension = img.extension || 'png';

            // Get the image position (row and column)
            const range = image.range;
            const row = range.tl.nativeRow + 1; // Convert to 1-based
            const col = range.tl.nativeCol + 1;

            console.log(`\n📷 Found image at Row ${row}, Col ${col}`);

            // Try to find operation code in nearby cells
            let operationCode = null;
            let partName = null;

            // Search in the same row and adjacent columns
            for (let checkCol = Math.max(1, col - 3); checkCol <= col + 3; checkCol++) {
                const cell = worksheet.getRow(row).getCell(checkCol);
                const value = cell.value?.toString().trim();

                if (value && value.includes('-')) {
                    // Likely an operation code (contains hyphen)
                    operationCode = value;
                    console.log(`  ✓ Found potential operation code: ${operationCode}`);
                    break;
                }
            }

            // Try to find the part name
            for (let checkCol = Math.max(1, col - 3); checkCol <= col + 3; checkCol++) {
                const cell = worksheet.getRow(row).getCell(checkCol);
                const value = cell.value?.toString().trim();

                if (value && !value.includes('-') && value.length > 3) {
                    partName = value;
                    break;
                }
            }

            // Generate filename
            let filename;
            if (operationCode) {
                const safeCode = operationCode.replace(/[^a-zA-Z0-9\-_]/g, '');
                filename = `${safeCode}.${extension}`;
            } else {
                filename = `image_row${row}_col${col}.${extension}`;
            }

            // Save the image
            const outputPath = path.join(outputDir, filename);
            fs.writeFileSync(outputPath, img.buffer);

            imageCount++;
            console.log(`  💾 Saved as: ${filename}`);

            if (operationCode) {
                imageMatches.push({
                    operationCode,
                    imagePath: filename,
                    partName: partName || undefined
                });
            }

        } catch (error) {
            console.error(`  ✗ Error processing image:`, error);
        }
    });

    console.log(`\n✅ Extracted ${imageCount} images to '${outputDir}'`);

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

    for (const match of imageMatches) {
        try {
            // Find the part in the database
            const part = await prisma.part.findFirst({
                where: {
                    operation_code: {
                        contains: match.operationCode,
                        mode: 'insensitive'
                    }
                }
            });

            if (part) {
                // Copy image to uploads folder
                const sourcePath = path.join(imageDir, match.imagePath);
                const targetPath = path.join(uploadsDir, match.imagePath);
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
                console.log(`  ⚠ No matching part found for code: ${match.operationCode}`);
            }
        } catch (error) {
            console.error(`  ✗ Error updating part ${match.operationCode}:`, error);
        }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} parts with images`);
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log('Usage: node src/importImages.js <path-to-excel-file> [output-directory]');
        console.log('Example: node src/importImages.js "D:\\\\Downloads\\\\Kitap2.xlsx"');
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
        const imageMatches = await extractImagesFromExcel(excelPath, outputDir);

        // Update database with matched images
        if (imageMatches.length > 0) {
            await updatePartsWithImages(imageMatches, outputDir);
        } else {
            console.log('\n⚠ No images were matched to operation codes.');
            console.log('Images were saved, but you may need to manually match them to parts.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();
