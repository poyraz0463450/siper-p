const ExcelJS = require('exceljs');

async function dump(path) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path);
    const ws = wb.worksheets[0];
    const row = ws.getRow(2);
    console.log('Row 2 Values:');
    row.eachCell((c, i) => {
        console.log(`Col ${i}: ${JSON.stringify(c.value)}`);
    });
}
dump(process.argv[2]);
