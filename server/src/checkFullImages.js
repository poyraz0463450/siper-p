const ExcelJS = require('exceljs');

async function checkImages(excelPath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    console.log('Worksheets:', workbook.worksheets.map(w => w.name));

    workbook.worksheets.forEach(sheet => {
        const images = sheet.getImages();
        console.log(`Sheet "${sheet.name}" has ${images.length} images.`);
        if (images.length > 0) {
            console.log('Sample image:', JSON.stringify(images[0], null, 2));
        }
    });
}

checkImages(process.argv[2]);
