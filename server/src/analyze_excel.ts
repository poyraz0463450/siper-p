import * as XLSX from 'xlsx';

const filePath = "D:\\Downloads\\deneme1 .xlsx";

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Get all data as arrays
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('Total Rows:', data.length);

    const colBCounts: Record<string, number> = {};
    const colCExamples: any[] = [];

    data.forEach((row: any) => {
        // Count Col B (Index 1)
        const valB = row[1];
        if (valB) {
            const key = String(valB).trim();
            colBCounts[key] = (colBCounts[key] || 0) + 1;
        }

        // Check Col C (Index 2)
        if (row[2]) {
            colCExamples.push(row[2]);
        }
    });

    console.log('--- Column B Distribution ---');
    console.log(JSON.stringify(colBCounts, null, 2));

    console.log('--- Column C Examples ---');
    console.log(JSON.stringify(colCExamples.slice(0, 10), null, 2));

} catch (error) {
    console.error('Error:', error);
}
