import React from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Download, FileText, Table } from 'lucide-react';
import { toast } from 'sonner';

interface ExportMenuProps {
    data: any[];
    columns: { header: string; key: string }[];
    filename?: string;
    title?: string;
}

export default function ExportMenu({ data, columns, filename = 'export', title = 'Rapor' }: ExportMenuProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    const exportPDF = () => {
        const doc = new jsPDF();

        // Add Title with proper Turkish character support
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, 22);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Olusturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

        // Prepare Data - Convert Turkish characters for PDF compatibility
        const tableData = data.map(item => columns.map(col => {
            const val = item[col.key];
            if (val === null || val === undefined) return '';
            if (typeof val === 'object') return JSON.stringify(val);
            // Convert Turkish characters to ASCII-safe equivalents for PDF
            return String(val)
                .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
                .replace(/ü/g, 'u').replace(/Ü/g, 'U')
                .replace(/ş/g, 's').replace(/Ş/g, 'S')
                .replace(/ı/g, 'i').replace(/İ/g, 'I')
                .replace(/ö/g, 'o').replace(/Ö/g, 'O')
                .replace(/ç/g, 'c').replace(/Ç/g, 'C');
        }));

        const headers = columns.map(c =>
            c.header
                .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
                .replace(/ü/g, 'u').replace(/Ü/g, 'U')
                .replace(/ş/g, 's').replace(/Ş/g, 'S')
                .replace(/ı/g, 'i').replace(/İ/g, 'I')
                .replace(/ö/g, 'o').replace(/Ö/g, 'O')
                .replace(/ç/g, 'c').replace(/Ç/g, 'C')
        );

        autoTable(doc, {
            head: [headers],
            body: tableData,
            startY: 40,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 }
        });

        doc.save(`${filename}.pdf`);
        toast.success('PDF basariyla indirildi');
        setIsOpen(false);
    };

    const exportExcel = () => {
        const wb = XLSX.utils.book_new();

        // Map data to headers
        const excelData = data.map(item => {
            const row: any = {};
            columns.forEach(col => {
                row[col.header] = item[col.key];
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, "Rapor");
        XLSX.writeFile(wb, `${filename}.xlsx`);
        toast.success('Excel başarıyla indirildi');
        setIsOpen(false);
    };

    return (
        <div className="relative group">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
                title="Dışa Aktar"
            >
                <Download className="h-5 w-5" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#1e293b] border border-white/10 shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-1">
                            <button
                                onClick={exportPDF}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
                            >
                                <FileText className="h-4 w-4 text-red-400" />
                                <span>PDF Olarak İndir</span>
                            </button>
                            <button
                                onClick={exportExcel}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
                            >
                                <Table className="h-4 w-4 text-green-400" />
                                <span>Excel Olarak İndir</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
