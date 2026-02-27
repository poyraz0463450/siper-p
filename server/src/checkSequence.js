const ExcelJS = require('exceljs');

async function checkSequence(excelPath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];

    for (let r = 2; r <= 6; r++) {
        const row = worksheet.getRow(r);
        console.log(`Row ${r}: ${row.getCell(1).value}`);
    }

    const images = worksheet.getImages();
    images.slice(0, 5).forEach(img => {
        console.log(`Image at Row ${img.range.tl.nativeRow + 1}`);
    });
}

checkSequence(process.argv[2]).catch(console.error);
