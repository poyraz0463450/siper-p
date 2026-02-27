const ExcelJS = require('exceljs');

async function listAllImages(excelPath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];

    console.log(`Total images: ${worksheet.getImages().length}`);

    worksheet.getImages().forEach((img, idx) => {
        const r = img.range.tl.nativeRow + 1;
        const c = img.range.tl.nativeCol + 1;
        // Get content of that row just to see
        const cellVal = worksheet.getRow(r).getCell(1).value;
        console.log(`Image ${idx}: Row ${r}, Col ${c} -> Row Content: "${cellVal}"`);
    });
}

listAllImages(process.argv[2]).catch(console.error);
