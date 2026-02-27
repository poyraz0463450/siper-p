const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function analyzeExcelStructure(excelPath) {
    console.log(`\n🔍 Analyzing Excel structure: ${excelPath}`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    const worksheet = workbook.worksheets[0];
    console.log(`\n📊 Worksheet: ${worksheet.name}`);
    console.log(`📏 Dimensions: ${worksheet.rowCount} rows x ${worksheet.columnCount} columns`);

    // Show first row (headers)
    console.log('\n📋 Column Headers:');
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        console.log(`  Col ${colNumber}: "${cell.value}"`);
    });

    // Show first 5 data rows
    console.log('\n📄 First 5 data rows:');
    for (let rowNum = 2; rowNum <= Math.min(6, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        const rowData = [];
        row.eachCell((cell, colNumber) => {
            let val = cell.value;
            if (typeof val === 'object' && val !== null) {
                if (val.richText) val = val.richText.map(r => r.text).join('');
                else if (val.text) val = val.text;
                else val = JSON.stringify(val);
            }
            rowData.push(`Col${colNumber}: "${val}"`);
        });
        console.log(`  Row ${rowNum}: ${rowData.join(' | ')}`);
    }

    // Analyze images
    console.log('\n🖼️  Image Analysis:');
    const images = worksheet.getImages();
    console.log(`Found ${images.length} images`);

    images.slice(0, 10).forEach((image, idx) => {
        const range = image.range;
        const row = range.tl.nativeRow + 1;
        const col = range.tl.nativeCol + 1;

        console.log(`\n  Image ${idx + 1}:`);
        console.log(`    Position: Row ${row}, Col ${col}`);
        console.log(`    Range: ${range.tl.nativeCol} to ${range.br.nativeCol} cols, ${range.tl.nativeRow} to ${range.br.nativeRow} rows`);

        // Show nearby cell values
        console.log(`    Nearby cells:`);
        for (let checkCol = Math.max(1, col - 2); checkCol <= Math.min(col + 2, worksheet.columnCount); checkCol++) {
            const cell = worksheet.getRow(row).getCell(checkCol);
            if (cell.value) {
                console.log(`      Col ${checkCol}: "${cell.value}"`);
            }
        }
    });
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log('Usage: node src/analyzeExcel.js <path-to-excel-file>');
        process.exit(1);
    }

    const excelPath = args[0];

    if (!fs.existsSync(excelPath)) {
        console.error(`❌ Error: File not found: ${excelPath}`);
        process.exit(1);
    }

    try {
        await analyzeExcelStructure(excelPath);
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

main();
