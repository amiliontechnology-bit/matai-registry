import { useState, useEffect } from "react";
import { collection, getDocs, writeBatch, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { cacheGet, cacheSet, cacheClear } from "../utils/cache";
import { logAudit } from "../utils/audit";

const SAVAII_DISTRICTS = [
  "FAASALELEAGA Nu 1", "FAASALELEAGA Nu 2", "FAASALELEAGA Nu 3", "FAASALELEAGA Nu. 04",
  "GAGAEMAUGA Nu.01", "GAGAEMAUGA Nu.02", "GAGAEMAUGA Nu.03",
  "GAGAIFOMAUGA Nu.03", "GAGAIFOMAUGA Nu.1", "GAGAIFOMAUGA Nu.2",
  "ALATAUA SISIFO", "FALEALUPO", "PALAULI", "PALAULI LE FALEFA", "PALAULI SISIFO",
  "SATUPAITEA", "VAISIGANO Nu.1", "VAISIGANO Nu.02", "SALEGA",
];

const getIsland = (district) => {
  const d = (district || "").trim().toUpperCase();
  return SAVAII_DISTRICTS.some(sd => sd.toUpperCase() === d) ? "SAVAII" : "UPOLU";
};

const fmt = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, day] = dateStr.split("-");
  return `${day}/${m}/${y}`;
};

const get28th = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-28`;
};

const addMonths = (dateStr, n) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const LOGO_URL = `${window.location.origin}/mjca_logo.jpeg`;

export default function Savali({ userRole }) {
  const [unproclaimed, setUnproclaimed] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [selected, setSelected]         = useState(new Set());
  const [editRecord, setEditRecord]     = useState(null);
  const [editForm, setEditForm]         = useState({});
  const [showConfirm, setShowConfirm]   = useState(false);
  const [proclamationDate, setProclamationDate] = useState(get28th());

  const loadRecords = async () => {
    setLoading(true);
    try {
      let all = cacheGet("registrations");
      if (!all) {
        const snap = await getDocs(collection(db, "registrations"));
        all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cacheSet("registrations", all);
      }
      const noProclaim = all.filter(r => !r.dateSavaliPublished || r.dateSavaliPublished.trim() === "");
      setUnproclaimed(noProclaim);
      setSelected(new Set(noProclaim.map(r => r.id)));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadRecords(); }, []);

  const toggleAll = () => {
    if (selected.size === unproclaimed.length) setSelected(new Set());
    else setSelected(new Set(unproclaimed.map(r => r.id)));
  };

  const toggleOne = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const openEdit = (r) => {
    setEditRecord(r);
    setEditForm({ village: r.village || "", mataiTitle: r.mataiTitle || "", holderName: r.holderName || "", faapogai: r.faapogai || "" });
  };

  const saveEdit = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "registrations", editRecord.id), editForm);
      cacheClear("registrations");
      await logAudit("EDIT_SAVALI_RECORD", { id: editRecord.id, changes: editForm });
      setEditRecord(null);
      await loadRecords();
    } catch (e) { alert("Error saving: " + e.message); }
    setSaving(false);
  };

  const handleSetDates = async () => {
    setSaving(true);
    const toSet = unproclaimed.filter(r => selected.has(r.id));
    try {
      const batch = writeBatch(db);
      toSet.forEach(r => batch.update(doc(db, "registrations", r.id), { dateSavaliPublished: proclamationDate }));
      await batch.commit();
      cacheClear("registrations");
      await logAudit("SET_PROCLAMATION_DATE", { date: proclamationDate, count: toSet.length, recordIds: toSet.map(r => r.id) });
      setShowConfirm(false);
      await loadRecords();
    } catch (e) { alert("Error setting dates: " + e.message); }
    setSaving(false);
  };

  const grouped = (rows) => {
    const sort = (arr) => [...arr].sort((a, b) => (a.village || "").localeCompare(b.village || ""));
    return {
      upolu:  sort(rows.filter(r => getIsland(r.district) === "UPOLU")),
      savaii: sort(rows.filter(r => getIsland(r.district) === "SAVAII")),
    };
  };

  const endDate = addMonths(proclamationDate, 4);
  const { upolu, savaii } = grouped(unproclaimed);

  const generatePDF = () => {
    const { upolu: pu, savaii: ps } = grouped(unproclaimed);
    const mkRows = (rows) => rows.map(r => `
      <tr>
        <td>${r.village || ""}</td>
        <td style="text-transform:uppercase">${r.mataiTitle || ""}</td>
        <td>${r.holderName || ""}</td>
        <td>${r.faapogai || ""}</td>
      </tr>`).join("");
    const mkSection = (island, rows) => rows.length === 0 ? "" : `
      <h2 class="island">${island}</h2>
      <table>
        <thead><tr><th>NUU</th><th>SUAFA MATAI</th><th>IGOA TAULEALEA</th><th>FAAPOGAI</th></tr></thead>
        <tbody>${mkRows(rows)}</tbody>
      </table>`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <title>Savali ${fmt(proclamationDate)}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10pt; margin: 15mm 20mm; color: #000; }
        .header { text-align: center; margin-bottom: 14px; }
        .header img { height: 70px; margin-bottom: 6px; display: block; margin-left: auto; margin-right: auto; }
        .header h1 { font-size: 14pt; margin: 0 0 2px; letter-spacing: 0.05em; }
        .header .daterange { font-size: 11pt; margin: 0; }
        .island { text-align: center; font-size: 12pt; letter-spacing: 0.12em; margin: 22px 0 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; page-break-inside: auto; }
        thead { display: table-header-group; }
        th, td { border: 1px solid #000; padding: 4px 7px; text-align: center; font-size: 9pt; }
        th { font-weight: bold; }
        tr { page-break-inside: avoid; }
        .footer { margin-top: 24px; font-size: 8pt; font-style: italic; display: flex; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 6px; }
        @media print { body { margin: 12mm 15mm; } }
      </style>
    </head><body>
      <div class="header">
        <img src="${LOGO_URL}" alt="Emblem" onerror="this.style.display='none'"/>
        <h1>LISI O LE SAVALI</h1>
        <p class="daterange">${fmt(proclamationDate)} &nbsp;&#9658;&nbsp; ${fmt(endDate)}</p>
      </div>
      ${mkSection("UPOLU", pu)}
      ${mkSection("SAVAII", ps)}
      <div class="footer">
        <span>SAVALI &mdash; ${fmt(proclamationDate)} &ndash; ${fmt(endDate)}</span>
        <span>Aofa'i: ${pu.length + ps.length} fa'amatalaga</span>
      </div>
    </body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, "_blank");
    if (win) win.addEventListener("load", () => {
      URL.revokeObjectURL(url);
      setTimeout(() => win.print(), 800);
    }, { once: true });
  };

  // Shared styles
  const TH = { border: "1px solid #d1d5db", padding: "0.55rem 0.75rem", textAlign: "center", fontWeight: 700, fontSize: "0.8rem", background: "#f1f5f9", letterSpacing: "0.04em" };
  const TD = (i) => ({ border: "1px solid #e5e7eb", padding: "0.5rem 0.75rem", textAlign: "center", fontSize: "0.86rem", background: i % 2 === 0 ? "#fff" : "#f9fafb" });

  const SectionTable = ({ rows, offset = 0 }) => {
    const allSel = rows.length > 0 && rows.every(r => selected.has(r.id));
    return (
      <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: "40px" }}>
                <input type="checkbox" checked={allSel} onChange={() => {
                  const s = new Set(selected);
                  rows.forEach(r => allSel ? s.delete(r.id) : s.add(r.id));
                  setSelected(s);
                }} />
              </th>
              {["NUU", "SUAFA MATAI", "IGOA TAULEALEA", "FAAPOGAI", ""].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td style={TD(i + offset)}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} />
                </td>
                <td style={TD(i + offset)}>{r.village || <span style={{ color: "#aaa" }}>—</span>}</td>
                <td style={{ ...TD(i + offset), textTransform: "uppercase" }}>{r.mataiTitle || <span style={{ color: "#aaa" }}>—</span>}</td>
                <td style={TD(i + offset)}>{r.holderName || <span style={{ color: "#aaa" }}>—</span>}</td>
                <td style={TD(i + offset)}>{r.faapogai || <span style={{ color: "#aaa" }}>—</span>}</td>
                <td style={{ ...TD(i + offset), width: "56px" }}>
                  <button onClick={() => openEdit(r)} title="Edit record"
                    style={{ background: "none", border: "1px solid #d1d5db", borderRadius: "4px", padding: "2px 8px", cursor: "pointer", fontSize: "0.8rem" }}>
                    ✏️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="page-container">

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2 className="page-title" style={{ margin: 0 }}>📰 Savali Report</h2>
        {unproclaimed.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button onClick={() => setShowConfirm(true)} disabled={selected.size === 0}
              style={{ padding: "0.45rem 1rem", borderRadius: "6px", border: "none", background: selected.size === 0 ? "#d1d5db" : "#f59e0b", color: "#fff", cursor: selected.size === 0 ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.88rem" }}>
              📅 Set Date ({selected.size})
            </button>
            <button onClick={generatePDF}
              style={{ padding: "0.45rem 1rem", borderRadius: "6px", border: "none", background: "#155c31", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem" }}>
              🖨 Print / PDF
            </button>
          </div>
        )}
      </div>

      {/* Date range + select-all */}
      {unproclaimed.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          <span style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "0.35rem 0.9rem", fontSize: "0.88rem", color: "#155c31", fontWeight: 600 }}>
            {fmt(proclamationDate)} – {fmt(endDate)}
          </span>
          <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
            {unproclaimed.length} record{unproclaimed.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
            <button onClick={toggleAll} style={{ background: "none", border: "none", color: "#155c31", cursor: "pointer", fontSize: "0.85rem", padding: 0, textDecoration: "underline" }}>
              {selected.size === unproclaimed.length ? "Deselect all" : "Select all"}
            </button>
          </span>
        </div>
      )}

      {/* Records */}
      {loading ? (
        <div className="loading">Loading records…</div>
      ) : unproclaimed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
          <p style={{ fontSize: "1.05rem" }}>All records have Savali published dates set.</p>
        </div>
      ) : (
        <>
          {upolu.length > 0 && (
            <>
              <h3 style={{ textAlign: "center", letterSpacing: "0.15em", color: "#155c31", margin: "0 0 0.6rem" }}>UPOLU</h3>
              <SectionTable rows={upolu} offset={0} />
            </>
          )}
          {savaii.length > 0 && (
            <>
              <h3 style={{ textAlign: "center", letterSpacing: "0.15em", color: "#155c31", margin: "1rem 0 0.6rem" }}>SAVAII</h3>
              <SectionTable rows={savaii} offset={upolu.length} />
            </>
          )}
        </>
      )}

      {/* Set Date modal */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "10px", padding: "2rem", maxWidth: "420px", width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0, color: "#155c31" }}>Set Savali Published Date</h3>
            <p style={{ color: "#374151", fontSize: "0.93rem" }}>
              Setting date for <strong>{selected.size} selected record{selected.size !== 1 ? "s" : ""}</strong>.
            </p>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem", fontSize: "0.88rem" }}>Savali Published Date</label>
              <input type="date" value={proclamationDate} onChange={e => setProclamationDate(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.95rem", boxSizing: "border-box" }} />
              <p style={{ fontSize: "0.82rem", color: "#6b7280", marginTop: "0.4rem" }}>
                Report range: <strong>{fmt(proclamationDate)} – {fmt(addMonths(proclamationDate, 4))}</strong>
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowConfirm(false)} disabled={saving}
                style={{ padding: "0.5rem 1.2rem", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSetDates} disabled={saving || !proclamationDate}
                style={{ padding: "0.5rem 1.2rem", borderRadius: "6px", border: "none", background: "#155c31", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                {saving ? "Saving…" : `Confirm — ${selected.size} Records`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Edit modal */}
      {editRecord && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "10px", padding: "2rem", maxWidth: "480px", width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0, color: "#155c31" }}>Edit Record</h3>
            {[
              { key: "village",    label: "NUU (Village)" },
              { key: "mataiTitle", label: "SUAFA MATAI (Matai Title)" },
              { key: "holderName", label: "IGOA TAULEALEA (Untitled Name)" },
              { key: "faapogai",   label: "FAAPOGAI" },
            ].map(({ key, label }) => (
              <div key={key} style={{ marginBottom: "0.9rem" }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.3rem", color: "#374151" }}>{label}</label>
                <input value={editForm[key] || ""} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "0.45rem 0.6rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.93rem", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button onClick={() => setEditRecord(null)} disabled={saving}
                style={{ padding: "0.5rem 1.2rem", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving}
                style={{ padding: "0.5rem 1.2rem", borderRadius: "6px", border: "none", background: "#155c31", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
