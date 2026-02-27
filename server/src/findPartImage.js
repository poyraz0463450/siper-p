const ExcelJS = require('exceljs');

async function findPartImage(excelPath, partCode) {
    console.log(`Searching for "${partCode}" in ${excelPath}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];

    // Find the row with the part code
    let partRow = null;
    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
            if (cell.value && cell.value.toString().trim() === partCode) {
                console.log(`✅ Found "${partCode}" at Row ${rowNumber}`);
                partRow = rowNumber;
            }
        });
    });

    if (!partRow) {
        console.log(`❌ Could not find "${partCode}" in the worksheet`);
        // Try partial match
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                if (cell.value && cell.value.toString().includes(partCode)) {
                    console.log(`⚠️  Found partial match "${cell.value}" at Row ${rowNumber}`);
                    partRow = rowNumber;
                }
            });
        });
        if (!partRow) return;
    }

    // Find images anchored to this row
    console.log(`Looking for images anchored to Row ${partRow} (nativeRow ${partRow - 1})...`);

    const images = worksheet.getImages();
    const rowImages = images.filter(img => {
        const r = img.range.tl.nativeRow + 1;
        return r === partRow || r === partRow - 1 || r === partRow + 1; // Check adjacent rows too
    });

    console.log(`Found ${rowImages.length} images near Row ${partRow}`);

    rowImages.forEach((img, idx) => {
        console.log(`\nImage ${idx}:`);
        console.log(`  ID: ${img.imageId}`);
        console.log(`  Anchor: Row ${img.range.tl.nativeRow + 1}, Col ${img.range.tl.nativeCol + 1}`);
        console.log(`  Range: ${JSON.stringify(img.range)}`);
    });

    // Also list ALL images to see if there's an offset issue
    if (rowImages.length === 0) {
        console.log('\nNo images found nearby. Listing first 5 images in sheet to check offsets:');
        images.slice(0, 5).forEach(img => {
            console.log(`  Image at Row ${img.range.tl.nativeRow + 1}, Col ${img.range.tl.nativeCol + 1}`);
        });
    }
}

findPartImage(process.argv[2], 'BRG9001-C').catch(console.error);
