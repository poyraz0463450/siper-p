const ExcelJS = require('exceljs');

async function listSheets(excelPath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    console.log('Sheets:');
    workbook.worksheets.forEach((sheet, idx) => {
        console.log(`  ${idx}: ${sheet.name} (Rows: ${sheet.rowCount}, Images: ${sheet.getImages().length})`);
    });
}

listSheets(process.argv[2]).catch(console.error);
