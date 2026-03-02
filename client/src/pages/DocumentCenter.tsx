import { useEffect, useState } from 'react';
import { FileText, Search, Upload, Eye, X, FileIcon, User } from 'lucide-react';
import { getAllDocuments, getDocumentsByPartCode, addDocument } from '../lib/firestoreService';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import type { TechnicalDocument } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { serverTimestamp } from 'firebase/firestore';

export default function DocumentCenter() {
    const { user } = useAuth();
    const [documents, setDocuments] = useState<TechnicalDocument[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPartCode, setSelectedPartCode] = useState('');
    const [partDocuments, setPartDocuments] = useState<TechnicalDocument[]>([]);
    const [viewingPdf, setViewingPdf] = useState<string | null>(null);
    const [showUpload, setShowUpload] = useState(false);
    const [_loading, setLoading] = useState(true);

    // Upload form
    const [uploadPartCode, setUploadPartCode] = useState('');
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadRevision, setUploadRevision] = useState(1);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => { loadAllDocs(); }, []);

    const loadAllDocs = async () => {
        setLoading(true);
        const docs = await getAllDocuments();
        setDocuments(docs);
        setLoading(false);
    };

    const searchByPartCode = async (code: string) => {
        setSelectedPartCode(code);
        const docs = await getDocumentsByPartCode(code);
        setPartDocuments(docs);
    };

    const handleSearch = () => {
        if (searchQuery.trim()) {
            searchByPartCode(searchQuery.trim().toUpperCase());
        }
    };

    const handleUpload = async () => {
        if (!uploadFile || !uploadPartCode || !uploadTitle) return;
        setUploading(true);
        try {
            // Upload to Firebase Storage
            const storageRef = ref(storage, `documents/${uploadPartCode}/${Date.now()}_${uploadFile.name}`);
            await uploadBytes(storageRef, uploadFile);
            const url = await getDownloadURL(storageRef);

            await addDocument({
                partCode: uploadPartCode.toUpperCase(),
                title: uploadTitle,
                revisionNumber: uploadRevision,
                fileUrl: url,
                fileType: uploadFile.type || 'application/pdf',
                uploadedBy: user?.displayName || user?.email || 'Bilinmeyen',
                uploadedAt: serverTimestamp(),
                isLatest: true,
            });

            setShowUpload(false);
            setUploadPartCode(''); setUploadTitle(''); setUploadRevision(1); setUploadFile(null);
            loadAllDocs();
            if (selectedPartCode) searchByPartCode(selectedPartCode);
        } catch (err) {
            console.error('Upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    const canUpload = user?.role === 'Admin' || user?.role === 'Engineer';
    const canDownload = user?.role === 'Admin';

    // Unique part codes for quick filter
    const uniquePartCodes = [...new Set(documents.map(d => d.partCode))].sort();

    const filteredDocs = searchQuery
        ? documents.filter(d =>
            d.partCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : documents;

    return (
        <div className="p-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <FileText className="w-6 h-6 text-violet-400" />
                        Döküman Merkezi
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Teknik çizimler ve revizyon yönetimi</p>
                </div>
                {canUpload && (
                    <button
                        onClick={() => setShowUpload(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/20"
                    >
                        <Upload className="w-4 h-4" />
                        Döküman Yükle
                    </button>
                )}
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Left panel — Part Code Filter */}
                <div className="w-72 flex-shrink-0 flex flex-col rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                    <div className="p-3 border-b border-white/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Parça kodu ara..."
                                className="w-full h-9 rounded-lg bg-white/5 border border-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <button
                            onClick={() => { setSelectedPartCode(''); setPartDocuments([]); }}
                            className={`w-full text-left px-4 py-2.5 text-sm border-b border-white/5 transition-colors ${!selectedPartCode ? 'bg-violet-500/10 text-violet-400' : 'text-muted-foreground hover:bg-white/5'}`}
                        >
                            Tümü ({documents.length})
                        </button>
                        {uniquePartCodes.map(code => (
                            <button
                                key={code}
                                onClick={() => searchByPartCode(code)}
                                className={`w-full text-left px-4 py-2.5 text-sm font-mono border-b border-white/5 transition-colors ${selectedPartCode === code ? 'bg-violet-500/10 text-violet-400' : 'text-muted-foreground hover:bg-white/5'
                                    }`}
                            >
                                {code}
                                <span className="text-xs text-muted-foreground ml-2">
                                    ({documents.filter(d => d.partCode === code).length})
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right panel — Document list */}
                <div className="flex-1 overflow-y-auto space-y-3">
                    {(selectedPartCode ? partDocuments : filteredDocs).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <FileText className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm">Döküman bulunamadı</p>
                        </div>
                    ) : (
                        (selectedPartCode ? partDocuments : filteredDocs).map(doc => (
                            <div key={doc.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex items-center gap-4 hover:bg-white/[0.04] transition-colors">
                                {/* Icon */}
                                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                    <FileIcon className="w-6 h-6 text-red-400" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-semibold text-foreground truncate">{doc.title}</span>
                                        {doc.isLatest && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                Güncel
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="font-mono">{doc.partCode}</span>
                                        <span>Rev. {doc.revisionNumber}</span>
                                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{doc.uploadedBy}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => setViewingPdf(doc.fileUrl)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        Görüntüle
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* PDF Viewer Modal */}
            {viewingPdf && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="w-full h-full max-w-5xl max-h-[90vh] m-6 flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-[#1a1f2e]">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                            <span className="text-sm font-semibold">Teknik Çizim Görüntüleyici</span>
                            <button onClick={() => setViewingPdf(null)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1">
                            <iframe
                                src={viewingPdf}
                                className="w-full h-full"
                                title="PDF Viewer"
                                sandbox={canDownload ? undefined : "allow-same-origin allow-scripts"}
                            />
                        </div>
                        {!canDownload && (
                            <div className="px-4 py-2 border-t border-white/5 text-xs text-muted-foreground text-center">
                                İndirme yetkisi sadece yöneticilere aittir.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Döküman Yükle</h3>
                            <button onClick={() => setShowUpload(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Parça Kodu</label>
                                <input value={uploadPartCode} onChange={e => setUploadPartCode(e.target.value)}
                                    placeholder="BRG00-01-64-0001"
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Başlık</label>
                                <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)}
                                    placeholder="Gövde Teknik Çizimi"
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Revizyon No</label>
                                <input type="number" min={1} value={uploadRevision} onChange={e => setUploadRevision(parseInt(e.target.value) || 1)}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">PDF Dosyası</label>
                                <input type="file" accept=".pdf" onChange={e => setUploadFile(e.target.files?.[0] || null)}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground file:bg-violet-500/10 file:text-violet-400 file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-xs file:mr-3" />
                            </div>
                        </div>
                        <button
                            onClick={handleUpload}
                            disabled={!uploadFile || !uploadPartCode || !uploadTitle || uploading}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:from-violet-600 hover:to-purple-700 transition-all"
                        >
                            {uploading ? 'Yükleniyor...' : 'Yükle'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
