import { useState, useEffect, useRef } from "react";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../firebase";
import { cacheGet, cacheSet, cacheClear } from "../utils/cache";
import { logAudit } from "../utils/audit";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Savaii districts — all others are Upolu
const SAVAII_DISTRICTS = [
  "FAASALELEAGA Nu 1", "FAASALELEAGA Nu 2", "FAASALELEAGA Nu 3", "FAASALELEAGA Nu. 04",
  "GAGAEMAUGA Nu.01", "GAGAEMAUGA Nu.02", "GAGAEMAUGA Nu.03",
  "GAGAIFOMAUGA Nu.03", "GAGAIFOMAUGA Nu.1", "GAGAIFOMAUGA Nu.2",
  "ALATAUA SISIFO", "FALEALUPO", "PALAULI", "PALAULI LE FALEFA", "PALAULI SISIFO",
  "SATUPAITEA", "VAISIGANO Nu.1", "VAISIGANO Nu.02", "SALEGA",
];

const getIsland = (district) =>
  SAVAII_DISTRICTS.includes((district || "").trim().toUpperCase()) ||
  SAVAII_DISTRICTS.some(d => d.toUpperCase() === (district || "").trim().toUpperCase())
    ? "SAVAII"
    : "UPOLU";

// Check by district string match (case-insensitive)
const getIslandFromDistrict = (district) => {
  const d = (district || "").trim().toUpperCase();
  return SAVAII_DISTRICTS.some(sd => sd.toUpperCase() === d) ? "SAVAII" : "UPOLU";
};

const fmt = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, day] = dateStr.split("-");
  return `${day}/${m}/${y}`;
};

const get28thOfMonth = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-28`;
};

const addMonths = (dateStr, n) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Savali({ userRole }) {
  const [records, setRecords] = useState([]);
  const [unproclaimed, setUnproclaimed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savaliRecords, setSavaliRecords] = useState([]);
  const [proclamationDate, setProclamationDate] = useState(get28thOfMonth());
  const printRef = useRef();

  const loadRecords = async () => {
    setLoading(true);
    try {
      let all = cacheGet("registrations");
      if (!all) {
        const snap = await getDocs(collection(db, "registrations"));
        all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cacheSet("registrations", all);
      }
      setRecords(all);
      const noProclaim = all.filter(r => !r.dateProclamation || r.dateProclamation.trim() === "");
      setUnproclaimed(noProclaim);
      // Build savali list: records without proclamation date
      setSavaliRecords(noProclaim);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadRecords(); }, []);

  const handleSetDates = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      unproclaimed.forEach(r => {
        batch.update(doc(db, "registrations", r.id), { dateProclamation: proclamationDate });
      });
      await batch.commit();
      cacheClear("registrations");
      await logAudit("SET_PROCLAMATION_DATE", {
        date: proclamationDate,
        count: unproclaimed.length,
        recordIds: unproclaimed.map(r => r.id),
      });
      setShowConfirm(false);
      await loadRecords();
    } catch (e) {
      console.error(e);
      alert("Error setting dates: " + e.message);
    }
    setSaving(false);
  };

  // Group records by island then sort by nuu (village)
  const grouped = () => {
    const upolu = savaliRecords
      .filter(r => getIslandFromDistrict(r.district) === "UPOLU")
      .sort((a, b) => (a.village || "").localeCompare(b.village || ""));
    const savaii = savaliRecords
      .filter(r => getIslandFromDistrict(r.district) === "SAVAII")
      .sort((a, b) => (a.village || "").localeCompare(b.village || ""));
    return { upolu, savaii };
  };

  const endDate = addMonths(proclamationDate, 4);

  const generatePDF = () => {
    const { upolu, savaii } = grouped();
    const doc2 = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc2.internal.pageSize.getWidth();

    const addSection = (island, rows, isFirst) => {
      if (!isFirst) doc2.addPage();

      // Header
      doc2.setFont("helvetica", "bold");
      doc2.setFontSize(13);
      doc2.text("LISI O LE SAVALI O TESEMA", pageW / 2, 20, { align: "center" });
      doc2.setFontSize(12);
      doc2.text(island, pageW / 2, 28, { align: "center" });
      doc2.setFontSize(11);
      doc2.text(`${fmt(proclamationDate)} - ${fmt(endDate)}`, pageW / 2, 35, { align: "center" });

      if (rows.length === 0) {
        doc2.setFont("helvetica", "normal");
        doc2.setFontSize(10);
        doc2.text("No records for this island.", pageW / 2, 50, { align: "center" });
        return;
      }

      autoTable(doc2, {
        startY: 40,
        head: [["NUU", "SUAFA MATAI", "IGOA TAULEALEA", "FAAPOGAI"]],
        body: rows.map(r => [
          r.village || "",
          r.mataiTitle || "",
          r.holderName || "",
          r.faapogai || "",
        ]),
        styles: { fontSize: 9, cellPadding: 3, halign: "center", valign: "middle" },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", lineWidth: 0.3, lineColor: [0, 0, 0] },
        bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 40 },
          2: { cellWidth: 55 },
          3: { cellWidth: 55 },
        },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        didDrawPage: (data) => {
          // Footer
          doc2.setFont("helvetica", "italic");
          doc2.setFontSize(8);
          const pageH = doc2.internal.pageSize.getHeight();
          doc2.text("SAVALI", 14, pageH - 10);
          doc2.text(`${fmt(proclamationDate)}  ──────►  ${fmt(endDate)}`, 14, pageH - 6);
          doc2.text(`${data.pageNumber}`, pageW - 14, pageH - 6, { align: "right" });
        },
      });
    };

    const { upolu, savaii } = grouped();
    addSection("UPOLU", upolu, true);
    addSection("SAVAII", savaii, false);

    doc2.save(`Savali_${proclamationDate}.pdf`);
  };

  const { upolu, savaii } = grouped();

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2 className="page-title" style={{ margin: 0 }}>📰 Savali Report</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {savaliRecords.length > 0 && (
            <button className="btn btn-primary" onClick={generatePDF}>
              🖨 Print / Download PDF
            </button>
          )}
        </div>
      </div>

      {/* Notification banner for unproclaimed records */}
      {!loading && unproclaimed.length > 0 && (
        <div style={{
          background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: "8px",
          padding: "1rem 1.25rem", marginBottom: "1.5rem",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem"
        }}>
          <div>
            <strong style={{ color: "#92400e" }}>⚠️ {unproclaimed.length} record{unproclaimed.length !== 1 ? "s" : ""} without a proclamation date</strong>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.88rem", color: "#78350f" }}>
              These records will appear in the Savali report. Would you like to set their proclamation date?
            </p>
          </div>
          <button className="btn btn-warning" onClick={() => setShowConfirm(true)}
            style={{ background: "#f59e0b", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
            Set Proclamation Date
          </button>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "10px", padding: "2rem", maxWidth: "420px", width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0, color: "#155c31" }}>Set Proclamation Date</h3>
            <p style={{ color: "#374151", fontSize: "0.95rem" }}>
              This will set the proclamation date for <strong>{unproclaimed.length} record{unproclaimed.length !== 1 ? "s" : ""}</strong> that currently have no date.
            </p>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem", fontSize: "0.88rem" }}>Proclamation Date</label>
              <input type="date" value={proclamationDate}
                onChange={e => setProclamationDate(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.95rem" }} />
              <p style={{ fontSize: "0.82rem", color: "#6b7280", marginTop: "0.4rem" }}>
                Report date range: <strong>{fmt(proclamationDate)} – {fmt(addMonths(proclamationDate, 4))}</strong>
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowConfirm(false)} disabled={saving}
                style={{ padding: "0.5rem 1.2rem", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSetDates} disabled={saving || !proclamationDate}
                style={{ padding: "0.5rem 1.2rem", borderRadius: "6px", border: "none", background: "#155c31", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                {saving ? "Saving…" : `Confirm — Set ${unproclaimed.length} Records`}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading records…</div>
      ) : savaliRecords.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
          <p style={{ fontSize: "1.05rem" }}>All records have proclamation dates set.<br />No records pending for the Savali report.</p>
        </div>
      ) : (
        <>
          {/* Date range display */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <span style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "0.4rem 1rem", fontSize: "0.92rem", color: "#155c31", fontWeight: 600 }}>
              {fmt(proclamationDate)} – {fmt(endDate)}
            </span>
            <span style={{ marginLeft: "1rem", color: "#6b7280", fontSize: "0.88rem" }}>{savaliRecords.length} record{savaliRecords.length !== 1 ? "s" : ""} total</span>
          </div>

          {/* UPOLU section */}
          {upolu.length > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ textAlign: "center", fontFamily: "'Cinzel', serif", letterSpacing: "0.15em", color: "#155c31", marginBottom: "0.75rem" }}>UPOLU</h3>
              <SavaliTable rows={upolu} />
            </div>
          )}

          {/* SAVAII section */}
          {savaii.length > 0 && (
            <div>
              <h3 style={{ textAlign: "center", fontFamily: "'Cinzel', serif", letterSpacing: "0.15em", color: "#155c31", marginBottom: "0.75rem" }}>SAVAII</h3>
              <SavaliTable rows={savaii} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SavaliTable({ rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["NUU", "SUAFA MATAI", "IGOA TAULEALEA", "FAAPOGAI"].map(h => (
              <th key={h} style={{ border: "1px solid #d1d5db", padding: "0.6rem 0.8rem", textAlign: "center", fontWeight: 700, letterSpacing: "0.05em", fontSize: "0.82rem" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
              <td style={{ border: "1px solid #d1d5db", padding: "0.55rem 0.8rem", textAlign: "center" }}>{r.village || ""}</td>
              <td style={{ border: "1px solid #d1d5db", padding: "0.55rem 0.8rem", textAlign: "center" }}>{r.mataiTitle || ""}</td>
              <td style={{ border: "1px solid #d1d5db", padding: "0.55rem 0.8rem", textAlign: "center" }}>{r.holderName || ""}</td>
              <td style={{ border: "1px solid #d1d5db", padding: "0.55rem 0.8rem", textAlign: "center" }}>{r.faapogai || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
