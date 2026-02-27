const ExcelJS = require('exceljs');

async function analyzeJson(excelPath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];

    const rows = [];
    for (let r = 1; r <= 5; r++) {
        const row = worksheet.getRow(r);
        rows.push({
            row: r,
            col1: row.getCell(1).value,
            col2: row.getCell(2).value,
            col7: row.getCell(7).value // Assuming GÖRSEL is col 7 based on earlier findings
        });
    }

    const images = worksheet.getImages().map((img, idx) => ({
        id: idx,
        imageId: img.imageId,
        range: {
            tl: { row: img.range.tl.nativeRow, col: img.range.tl.nativeCol },
            br: { row: img.range.br.nativeRow, col: img.range.br.nativeCol }
        }
    }));

    console.log(JSON.stringify({ rows, images }, null, 2));
}

analyzeJson(process.argv[2]).catch(console.error);
