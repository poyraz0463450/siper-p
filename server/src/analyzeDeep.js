const ExcelJS = require('exceljs');
const fs = require('fs');

async function analyzeExcelDeep(excelPath) {
    console.log(`\n🔍 Analyzing Excel: ${excelPath}`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];

    console.log(`\n📄 Data in first 3 rows:`);
    for (let r = 1; r <= 3; r++) {
        const row = worksheet.getRow(r);
        const values = [];
        row.eachCell((cell, col) => {
            values.push(`[${col}]:${cell.value}`);
        });
        console.log(`Row ${r}: ${values.join(' | ')}`);
    }

    const images = worksheet.getImages();
    console.log(`\n🖼️  Found ${images.length} images.`);

    console.log('\nTop 10 Images info:');
    images.slice(0, 10).forEach((img, idx) => {
        const range = img.range;
        // Native rows/cols are 0-indexed in ExcelJS ranges
        const rowStart = range.tl.nativeRow + 1;
        const rowEnd = range.br.nativeRow + 1;
        const colStart = range.tl.nativeCol + 1;
        const colEnd = range.br.nativeCol + 1;

        console.log(`Image ${idx}: Row ${rowStart}-${rowEnd}, Col ${colStart}-${colEnd} (ID: ${img.imageId})`);

        // Check what text is in those rows
        for (let r = rowStart; r <= rowEnd; r++) {
            const rowVal = worksheet.getRow(r).getCell(1).value; // Assuming code is in Col 1 as per user screenshot (partially visible)
            // User screenshot shows 'KOD' in column 1 basically? 
            // Actually in previous analysis code column was detected.
            // Let's print values of Col 1 and 2 for these rows
            const c1 = worksheet.getRow(r).getCell(1).value;
            const c2 = worksheet.getRow(r).getCell(2).value;
            console.log(`   -> Row ${r} content: Col1="${c1}", Col2="${c2}"`);
        }
    });

}

analyzeExcelDeep(process.argv[2]).catch(console.error);
