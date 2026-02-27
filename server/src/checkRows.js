const ExcelJS = require('exceljs');

async function checkRows(excelPath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];

    console.log('Row 2 Content:');
    const r2 = worksheet.getRow(2);
    console.log(`  Col 1: ${r2.getCell(1).value}`);
    console.log(`  Col 2: ${r2.getCell(2).value}`);

    console.log('Row 5 Content:');
    const r5 = worksheet.getRow(5);
    console.log(`  Col 1: ${r5.getCell(1).value}`);
    console.log(`  Col 2: ${r5.getCell(2).value}`);

    const images = worksheet.getImages();
    if (images.length > 0) {
        const img0 = images[0];
        console.log(`First Image Anchor: Row ${img0.range.tl.nativeRow + 1}`);
    }
}

checkRows(process.argv[2]).catch(console.error);
