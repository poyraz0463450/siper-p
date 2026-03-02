import React, { useState, useEffect } from 'react';
import { X, Save, Building2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { getAllSuppliers, createPurchaseRequest } from '../lib/firestoreService';
import type { Supplier } from '../lib/types';

interface PurchaseRequestModalProps {
    part: any;
    requiredQuantity: number;
    currentStock: number;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PurchaseRequestModal({ part, requiredQuantity, currentStock, onClose, onSuccess }: PurchaseRequestModalProps) {
    const [quantity, setQuantity] = useState(0);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<string>('');

    useEffect(() => {
        const missing = Math.max(0, requiredQuantity - currentStock);
        setQuantity(missing);

        getAllSuppliers().then(setSuppliers).catch(err => console.error(err));
    }, [requiredQuantity, currentStock]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const supplier = suppliers.find(s => s.id === selectedSupplier);
            await createPurchaseRequest({
                prCode: '',
                partId: part.id,
                partName: part.name || '',
                quantity: Number(quantity),
                status: 'pending',
                supplierId: selectedSupplier || undefined,
                supplierName: supplier?.name || undefined,
                notes: notes || undefined,
            });

            toast.success('Satın alma talebi oluşturuldu');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Talep oluşturulurken hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#0f172a] w-full max-w-md rounded-2xl border border-blue-500/20 shadow-2xl overflow-hidden scale-in-95 zoom-in-95 animate-in duration-200">
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-400" />
                        Talep Oluştur
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-blue-200 font-medium">{part.name}</span>
                            <span className="text-xs text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">{part.partCode || part.operation_code || '-'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground mt-3">
                            <div>
                                <div className="mb-1">Gerekli Miktar</div>
                                <div className="text-white font-mono text-lg">{requiredQuantity}</div>
                            </div>
                            <div className="text-right">
                                <div className="mb-1">Mevcut Stok</div>
                                <div className={currentStock < requiredQuantity ? "text-red-400 font-bold font-mono text-lg" : "text-emerald-400 font-mono text-lg"}>
                                    {currentStock}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Talep Edilen Miktar</label>
                        <div className="relative">
                            <input
                                type="number"
                                required
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                            />
                            <div className="absolute right-3 top-3 text-xs text-muted-foreground">Adet</div>
                        </div>
                        {quantity > 0 && (
                            <div className="flex items-center gap-2 text-xs text-emerald-400 mt-1">
                                <Calculator className="h-3 w-3" />
                                <span>Tahmini Stok Sonrası: {currentStock + quantity}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Tedarikçi (Opsiyonel)</label>
                        <select
                            value={selectedSupplier}
                            onChange={(e) => setSelectedSupplier(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 appearance-none"
                        >
                            <option value="">Seçiniz...</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Notlar</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Örn: Acil sipariş..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors font-medium text-sm"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={loading || quantity <= 0}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                            Talep Oluştur
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
