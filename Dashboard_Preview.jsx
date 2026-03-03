import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Line } from "recharts";

const STATUS_CONFIG = {
  draft: { label: "Taslak", color: "#78909C", bg: "#ECEFF1" },
  pending_approval: { label: "Onay Bekliyor", color: "#E65100", bg: "#FFF3E0" },
  approved: { label: "Onaylı", color: "#1565C0", bg: "#E3F2FD" },
  in_production: { label: "Üretimde", color: "#2E7D32", bg: "#E8F5E9" },
  quality_check: { label: "Kalite Kontrol", color: "#6A1B9A", bg: "#F3E5F5" },
  completed: { label: "Tamamlandı", color: "#1B5E20", bg: "#C8E6C9" },
  cancelled: { label: "İptal", color: "#B71C1C", bg: "#FFCDD2" },
};

const PIE_COLORS = ["#1B2A4A", "#C8102E", "#2E7D32", "#E65100", "#1565C0", "#6A1B9A", "#78909C"];

const mockOrders = [
  { order_number: "UE-2026-00012", model_name: "MPT-76", quantity: 50, status: "in_production", priority: "high", created_at: "2026-02-28" },
  { order_number: "UE-2026-00011", model_name: "MP5 A3", quantity: 200, status: "quality_check", priority: "urgent", created_at: "2026-02-25" },
  { order_number: "UE-2026-00010", model_name: "SAR 109T", quantity: 100, status: "approved", priority: "normal", created_at: "2026-02-22" },
  { order_number: "UE-2026-00009", model_name: "Kırıkkale P14", quantity: 150, status: "pending_approval", priority: "normal", created_at: "2026-02-20" },
  { order_number: "UE-2026-00008", model_name: "MPT-55", quantity: 75, status: "completed", priority: "high", created_at: "2026-02-15" },
  { order_number: "UE-2026-00007", model_name: "SAR 223", quantity: 300, status: "completed", priority: "normal", created_at: "2026-02-10" },
];

const mockLowStock = [
  { part_name: "Namlu (4140 Çelik)", part_code: "NAM-001", quantity: 12, min_quantity: 50, is_critical: true },
  { part_name: "Tetik Mekanizması", part_code: "MEK-012", quantity: 8, min_quantity: 30, is_critical: true },
  { part_name: "Sürgü Yayı", part_code: "YAP-003", quantity: 45, min_quantity: 100, is_critical: false },
  { part_name: "Emniyet Mandalı", part_code: "MEK-024", quantity: 18, min_quantity: 40, is_critical: true },
  { part_name: "Kabza Grip", part_code: "KUN-007", quantity: 25, min_quantity: 50, is_critical: false },
  { part_name: "Gez Mekanizması", part_code: "NIS-002", quantity: 30, min_quantity: 45, is_critical: false },
  { part_name: "Arpacık", part_code: "NIS-005", quantity: 22, min_quantity: 40, is_critical: false },
];

const pieData = [
  { name: "Tamamlandı", value: 24 },
  { name: "Üretimde", value: 8 },
  { name: "Onaylı", value: 5 },
  { name: "Onay Bekliyor", value: 3 },
  { name: "Taslak", value: 2 },
];

const invData = [
  { name: "NAM-001", mevcut: 12, minimum: 50 },
  { name: "MEK-012", mevcut: 8, minimum: 30 },
  { name: "MEK-024", mevcut: 18, minimum: 40 },
  { name: "NIS-005", mevcut: 22, minimum: 40 },
  { name: "KUN-007", mevcut: 25, minimum: 50 },
  { name: "YAP-003", mevcut: 45, minimum: 100 },
  { name: "NIS-002", mevcut: 30, minimum: 45 },
  { name: "SRG-011", mevcut: 55, minimum: 60 },
];

const monthlyData = [
  { name: "Oca", uretim: 18, hedef: 20 },
  { name: "Şub", uretim: 22, hedef: 20 },
  { name: "Mar", uretim: 15, hedef: 20 },
];

const PRIORITY_CONFIG = { low: { label: "Düşük", color: "#78909C" }, normal: { label: "Normal", color: "#1565C0" }, high: { label: "Yüksek", color: "#E65100" }, urgent: { label: "Acil", color: "#B71C1C" } };

const s = {
  page: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", background: "#F4F6F9", minHeight: "100vh", padding: "28px 32px" },
  hdr: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, paddingBottom: 20, borderBottom: "2px solid #E8ECF2" },
  h1: { fontSize: 26, fontWeight: 700, color: "#1B2A4A", margin: 0, display: "flex", alignItems: "center", gap: 10 },
  greet: { fontSize: 14, color: "#607D8B", margin: "6px 0 0" },
  date: { display: "inline-block", marginLeft: 12, paddingLeft: 12, borderLeft: "1px solid #CFD8DC", color: "#90A4AE", fontSize: 13 },
  ref: { background: "#F5F7FA", border: "1px solid #E0E0E0", color: "#607D8B", width: 38, height: 38, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
  kgrid: { display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14, marginBottom: 24 },
  kcard: (hover) => ({ background: "white", borderRadius: 10, padding: "18px 16px", display: "flex", alignItems: "center", gap: 12, border: "1px solid #EEF0F4", boxShadow: hover ? "0 4px 16px rgba(27,42,74,.1)" : "0 1px 4px rgba(0,0,0,.06)", cursor: "pointer", transition: "all .2s", position: "relative", overflow: "hidden", transform: hover ? "translateY(-2px)" : "none", borderLeft: hover ? "3px solid #1B2A4A" : "3px solid transparent" }),
  kicon: (bg, c) => ({ width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: bg, color: c, flexShrink: 0 }),
  kval: { fontSize: 26, fontWeight: 800, color: "#1B2A4A", lineHeight: 1.1, letterSpacing: -0.5 },
  klab: { fontSize: 11.5, color: "#78909C", fontWeight: 500, marginTop: 2 },
  crow: { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, marginBottom: 18 },
  ccard: { background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #EEF0F4", overflow: "hidden" },
  chdr: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 12px", borderBottom: "1px solid #F5F5F5" },
  ch3: { fontSize: 15, fontWeight: 600, color: "#1B2A4A", margin: 0, display: "flex", alignItems: "center", gap: 8 },
  csub: { fontSize: 12, color: "#90A4AE" },
  cbod: { padding: "16px 12px 8px" },
  brow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 },
  phdr: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #F5F5F5" },
  plink: { fontSize: 12, color: "#1565C0", textDecoration: "none", fontWeight: 500, cursor: "pointer" },
  pbod: { padding: "12px 16px", maxHeight: 360, overflowY: "auto" },
  arow: (crit) => ({ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: crit ? "#FFF8F8" : "#FAFBFC", border: "1px solid #EEF0F4", borderLeft: crit ? "3px solid #C8102E" : "1px solid #EEF0F4", marginBottom: 8 }),
  aname: { fontSize: 13, fontWeight: 600, color: "#37474F" },
  acode: { fontSize: 11, color: "#90A4AE", fontFamily: "Courier New, monospace" },
  sbar: { width: 60, height: 6, background: "#ECEFF1", borderRadius: 3, overflow: "hidden" },
  snum: { fontSize: 12, color: "#607D8B", whiteSpace: "nowrap" },
  cbadge: { fontSize: 9, fontWeight: 700, color: "#C8102E", background: "#FFEBEE", padding: "2px 6px", borderRadius: 4, letterSpacing: 0.5 },
  orow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: "#FAFBFC", border: "1px solid #EEF0F4", marginBottom: 6 },
  onum: { fontSize: 13, fontWeight: 700, color: "#1B2A4A", fontFamily: "Courier New, monospace", letterSpacing: .3 },
  omod: { fontSize: 12, color: "#78909C" },
  oqty: { fontSize: 13, fontWeight: 600, color: "#37474F" },
  odate: { fontSize: 11, color: "#B0BEC5" },
  sbadge: (c, bg) => ({ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 12, color: c, background: bg, whiteSpace: "nowrap" }),
  pdot: (c) => ({ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0, display: "inline-block" }),
  qs: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 6 },
  qsc: { background: "#F8F9FC", border: "1px solid #EEF0F4", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 },
  qsv: { fontSize: 20, fontWeight: 800, color: "#1B2A4A", lineHeight: 1.1 },
  qsl: { fontSize: 11, color: "#90A4AE", marginTop: 2 },
};

export default function Dashboard() {
  const [hov, setHov] = useState(null);
  const now = new Date();
  const dateStr = now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const kpis = [
    { id: "models", icon: "⬡", val: 12, label: "Silah Modeli", bg: "#E8EDF5", c: "#1B2A4A" },
    { id: "parts", icon: "⚙", val: 347, label: "Toplam Parça", bg: "#ECEFF1", c: "#455A64" },
    { id: "prod", icon: "▶", val: 8, label: "Üretimde", bg: "#E8F5E9", c: "#2E7D32" },
    { id: "pend", icon: "⏱", val: 8, label: "Bekleyen Emir", bg: "#FFF8E1", c: "#E65100" },
    { id: "low", icon: "⚠", val: 7, label: "Düşük Stok", bg: "#FFEBEE", c: "#C8102E" },
    { id: "done", icon: "✓", val: 24, label: "Tamamlanan", bg: "#E3F2FD", c: "#0D47A1" },
  ];

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={s.hdr}>
        <div>
          <h1 style={s.h1}><span style={{ color: "#C8102E", fontSize: 24 }}>🛡</span> Kontrol Paneli</h1>
          <p style={s.greet}>İyi günler, <strong style={{ color: "#37474F" }}>Silah Tasarım Mühendisi</strong><span style={s.date}>{dateStr}</span></p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative", fontSize: 20, color: "#607D8B", cursor: "pointer" }}>🔔<span style={{ position: "absolute", top: -6, right: -8, background: "#C8102E", color: "white", fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>3</span></div>
          <button style={s.ref}>↻</button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={s.kgrid}>
        {kpis.map(k => (
          <div key={k.id} style={s.kcard(hov === k.id)} onMouseEnter={() => setHov(k.id)} onMouseLeave={() => setHov(null)}>
            <div style={s.kicon(k.bg, k.c)}>{k.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={s.kval}>{k.val}</div>
              <div style={s.klab}>{k.label}</div>
            </div>
            <span style={{ color: "#CFD8DC", fontSize: 16 }}>›</span>
          </div>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div style={s.crow}>
        <div style={s.ccard}>
          <div style={s.chdr}><h3 style={s.ch3}>📈 Üretim Trendi</h3><span style={s.csub}>2026 yılı aylık</span></div>
          <div style={s.cbod}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={monthlyData}>
                <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1B2A4A" stopOpacity={.3} /><stop offset="95%" stopColor="#1B2A4A" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF2" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#607D8B" }} />
                <YAxis tick={{ fontSize: 12, fill: "#607D8B" }} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E0E0E0", borderRadius: 8, fontSize: 13 }} />
                <Area type="monotone" dataKey="uretim" name="Üretim" stroke="#1B2A4A" fill="url(#g1)" strokeWidth={2.5} />
                <Line type="monotone" dataKey="hedef" name="Hedef" stroke="#C8102E" strokeDasharray="5 5" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={s.ccard}>
          <div style={s.chdr}><h3 style={s.ch3}>🎯 Emir Dağılımı</h3><span style={s.csub}>Toplam: 42</span></div>
          <div style={s.cbod}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: "#90A4AE", strokeWidth: 1 }}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* INVENTORY BAR CHART */}
      <div style={{ ...s.ccard, marginBottom: 18 }}>
        <div style={s.chdr}><h3 style={s.ch3}>📦 Kritik Stok Durumu</h3><span style={s.csub}>En düşük stok oranına sahip parçalar</span></div>
        <div style={s.cbod}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={invData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF2" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#607D8B" }} />
              <YAxis tick={{ fontSize: 12, fill: "#607D8B" }} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E0E0E0", borderRadius: 8, fontSize: 13 }} />
              <Bar dataKey="mevcut" name="Mevcut Stok" fill="#1B2A4A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="minimum" name="Min. Stok" fill="#C8102E" radius={[4, 4, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BOTTOM PANELS */}
      <div style={s.brow}>
        {/* Low Stock */}
        <div style={s.ccard}>
          <div style={s.phdr}><h3 style={{ ...s.ch3, gap: 8 }}><span style={{ color: "#E65100" }}>⚠</span> Düşük Stok Uyarıları</h3><span style={s.plink}>Tümünü Gör ›</span></div>
          <div style={s.pbod}>
            {mockLowStock.map((item, i) => (
              <div key={i} style={s.arow(item.is_critical)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.aname}>{item.part_name}</div>
                  <div style={s.acode}>{item.part_code}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <div style={s.sbar}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(100, item.min_quantity > 0 ? (item.quantity / item.min_quantity) * 100 : 0)}%`, background: item.quantity === 0 ? "#B71C1C" : item.quantity < item.min_quantity / 2 ? "#E65100" : "#F57F17" }} />
                  </div>
                  <span style={s.snum}><strong style={{ color: "#37474F" }}>{item.quantity}</strong> / {item.min_quantity}</span>
                </div>
                {item.is_critical && <span style={s.cbadge}>KRİTİK</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div style={s.ccard}>
          <div style={s.phdr}><h3 style={s.ch3}>📋 Son Üretim Emirleri</h3><span style={s.plink}>Tümünü Gör ›</span></div>
          <div style={s.pbod}>
            {mockOrders.map((o, i) => {
              const sc = STATUS_CONFIG[o.status] || { label: o.status, color: "#78909C", bg: "#ECEFF1" };
              const pc = PRIORITY_CONFIG[o.priority] || { color: "#78909C" };
              return (
                <div key={i} style={s.orow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.onum}>{o.order_number}</div>
                    <div style={s.omod}>{o.model_name}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={s.oqty}>{o.quantity} adet</div>
                    <div style={s.odate}>{o.created_at}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={s.sbadge(sc.color, sc.bg)}>{sc.label}</span>
                    {o.priority !== "normal" && <span style={s.pdot(pc.color)} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* QUICK STATS FOOTER */}
      <div style={s.qs}>
        {[
          { icon: "⚡", val: "57%", label: "Tamamlanma Oranı" },
          { icon: "🎯", val: "23", label: "Emniyet Kritik Parça" },
          { icon: "📦", val: "340", label: "Stokta Yeterli" },
          { icon: "📈", val: "32", label: "Aktif Üretim" },
        ].map((q, i) => (
          <div key={i} style={s.qsc}>
            <span style={{ fontSize: 22 }}>{q.icon}</span>
            <div>
              <div style={s.qsv}>{q.val}</div>
              <div style={s.qsl}>{q.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
