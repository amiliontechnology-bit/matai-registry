import { useState, useEffect } from "react";
import { collection, getDocs, deleteDoc, doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";
import { Navigate } from "react-router-dom";
import { cacheGet, cacheSet, cacheClear } from "../utils/cache";

// ── Default district/village data (used to seed Firestore if not yet saved) ──
const DEFAULT_DISTRICT_VILLAGES = {
  "AANA ALOFI Nu.03": ['Faleatiu', 'Fasitoo-Tai', 'Satapuala', 'Satuimalufilufi', 'Vailuutai'],
  "AANA ALOFI Nu.1": ['Faleasiu', 'Fasitoouta'],
  "AANA ALOFI Nu.2": ['Leulumoega', 'Noafoalii'],
  "AIGA I LE TAI": ['Apai & Satuilagi', 'Apolima Tai', 'Apolima Uta', 'Faleu Tai', 'Faleu Uta', 'Fuailoloo', 'Lalovi Mulifanua', 'Lepuai', 'Salua & Satoi'],
  "ALATAUA SISIFO": ['Falelima', 'Neiafu', 'Tufutafoe'],
  "ALEIPATA ITUPA I LALO": ['Amaile', 'Lotopue', 'Malaela & Mutiatele', 'Saleaaumua', 'Samusu', 'Satitoa', 'Tiavea', 'Utufaalalafa'],
  "ALEIPATA ITUPA I LUGA": ['Lalomanu', 'Ulutogia', 'Vailoa Aleipata'],
  "ANOAMAA SASA'E": ['Falefa', 'Falevao', 'Lalomauga', 'Lufilufi', 'Manunu', 'Saletele', 'Sauano'],
  "ANOAMAA SISIFO": ['Eva', 'Leusoalii', 'Luatuanuu', 'Salelesi', 'Saoluafata', 'Solosolo'],
  "FAASALELEAGA Nu 1": ['Iva', 'Lalomalava', 'Safua', 'Salelavalu', 'Salelologa', 'Vaiafai', 'Vaisaulu'],
  "FAASALELEAGA Nu 2": ['Eveeve & Vaimaga', 'Fatausi', 'Fogapoa & Tuasivi', 'Fusi & Fuifatu', 'Sapapalii', 'Tapueleele'],
  "FAASALELEAGA Nu 3": ['Malae & Salimu', 'Saasaai', 'Saipipi', 'Sapini & Luua', 'Siufaga'],
  "FAASALELEAGA Nu. 04": ['Asaga', 'Falanai', 'Lano', 'Puapua'],
  "FALEALILI": ['Malaemalu & Tafatafa', 'Matautu Falealili', 'Poutasi', 'Salani', 'Saleilua', 'Salesatele', 'Sapoe / Utulaelae', 'Sapunaoa', 'Satalo', 'Siuniu', 'Vaovai'],
  "FALEALUPO": ['Avata', 'Vaotupua'],
  "FALEATA SASA'E": ['Lepea', 'Vailoa Faleata', 'Vaimoso'],
  "FALEATA SISIFO": ['Saina', 'Toamua / Puipaa', 'Vaigaga', 'Vaitele', 'Vaiusu'],
  "GAGAEMAUGA Nu.01": ['Leauvaa', 'Lemalu', 'Mauga', 'Patamea', 'Samalaeulu'],
  "GAGAEMAUGA Nu.02": ['Salamumu', 'Saleaula'],
  "GAGAEMAUGA Nu.03": ['Avao', 'Fagamalo', 'Lelepa', 'Safai', 'Saleia', 'Satoaleapai', 'Vaipouli'],
  "GAGAIFOMAUGA Nu.03": ['Aopo', 'Fagaee', 'Letui', 'Sasina'],
  "GAGAIFOMAUGA Nu.1": ['Manase', 'Safotu'],
  "GAGAIFOMAUGA Nu.2": ['Faletagaloa', 'Fatuvalu', 'Lefagoalii', 'Matavai', 'Paia', 'Samauga'],
  "LEFAGA & FALEASEELA": ['Faleaseela', 'Gagaifolevao', 'Matafaa', 'Matautu Lefaga', 'Safaatoa', 'Savaia & Tafagamanu'],
  "LEPA": ['Aufaga', 'Lepa & Vaigalu', 'Saleapaga & Siupapa'],
  "LOTOFAGA": ['Matautu', 'Vavau'],
  "PALAULI": ['Faala', 'Vailoa', 'Vaitoomuli'],
  "PALAULI LE FALEFA": ['Gataivai', 'Gautavai', 'Papa Puleia', 'Puleia', 'Sili', 'Tafua'],
  "PALAULI SISIFO": ['Foalalo', 'Foaluga', 'Salailua', 'Satuiatua', 'Siutu', 'Taga'],
  "SAFATA": ['Fausaga', 'Fusi', 'Lotofaga', 'Mulivai', 'Niusuatia', 'Saanapu', 'Sataoa', 'Tafitoala', 'Vaiee'],
  "SAGAGA LE FALEFA": ['Faleula', 'Levi & Alamutu', "Lotoso'A", "Salepoua'E & Nono'A", 'Utualii & Tufulele'],
  "SAGAGA LE USOGA": ['Afega', 'Malie', 'Tuanai'],
  "SALEGA": ['Fagafau', 'Faiaai', 'Fogasavaii', 'Fogatuli', 'Sagone', 'Samata- Uta', 'Samata-Tai', 'Siuvao', 'Vaipua'],
  "SAMATAU & FALELATAI": ["Falevai & Sama'I", 'Matautu & Levi', 'Pata', 'Samatau', 'Siufaga Falelatai'],
  "SATUPAITEA": ['Mosula', 'Pitonuu', 'Satufia', 'Vaeaga'],
  "SIUMU": ['Maninoa', 'Matafala', 'Saaga', "Siumu Sasa'E"],
  "VAA O FONOTI": ['Faleapuna', 'Lona', 'Maasina', 'Musumusu & Salimu', 'Samamea', 'Taelefaga', 'Uafato'],
  "VAIMAUGA SASA'E": ['Fagalii', 'Laulii', 'Letogo', 'Vailele'],
  "VAIMAUGA SISIFO": ['Alamagoto', 'Apia', 'Magiagi', 'Moataa', 'Tanugamanono', 'Vaiala', 'Vailima'],
  "VAISIGANO Nu.02": ['Fagasa', 'Papa Sataua', 'Sataua'],
  "VAISIGANO Nu.1": ['Auala', 'Matavai Asau', 'Utuloa Asau', 'Vaisala'],
};

export default function DataManage({ userRole }) {
  const perms = getPermissions(userRole);
  if (!perms.canDelete) return <Navigate to="/dashboard" />;

  const [records,       setRecords]       = useState([]);
  const [imports,       setImports]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [mode,          setMode]          = useState("home"); // home | undo | bulk | districts
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [deleting,      setDeleting]      = useState(false);
  const [done,          setDone]          = useState("");
  const [error,         setError]         = useState("");
  const [progress,      setProgress]      = useState(0);
  const [confirmOpen,   setConfirmOpen]   = useState(false);
  const [searchTerm,    setSearchTerm]    = useState("");

  // District/village editor state
  const [districtVillages, setDistrictVillages] = useState({});
  const [dvLoading,        setDvLoading]        = useState(false);
  const [dvSaving,         setDvSaving]         = useState(false);
  const [dvDone,           setDvDone]           = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [editingVillages,  setEditingVillages]  = useState(""); // comma-separated string for editing
  const [newDistrictName,  setNewDistrictName]  = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const cached = cacheGet("registrations");
      const all = cached || await getDocs(collection(db, "registrations")).then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cacheSet("registrations", list);
        return list;
      });
      setRecords(all);
      const cachedAudit = cacheGet("auditLog");
      const batches = cachedAudit || await getDocs(collection(db, "auditLog")).then(snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.() || new Date() }))
          .filter(d => d.action === "IMPORT")
          .sort((a, b) => b.timestamp - a.timestamp);
        cacheSet("auditLog", list);
        return list;
      });
      setImports(batches);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const loadDistrictVillages = async () => {
    setDvLoading(true);
    try {
      const cached = cacheGet("districtVillages");
      if (cached) { setDistrictVillages(cached); setDvLoading(false); return; }
      const snap = await getDoc(doc(db, "settings", "districtVillages"));
      const data = snap.exists() ? (snap.data().data || DEFAULT_DISTRICT_VILLAGES) : DEFAULT_DISTRICT_VILLAGES;
      cacheSet("districtVillages", data);
      setDistrictVillages(data);
    } catch (err) { setError(err.message); }
    finally { setDvLoading(false); }
  };

  const saveDistrictVillages = async (updated) => {
    setDvSaving(true); setDvDone(""); setError("");
    try {
      await setDoc(doc(db, "settings", "districtVillages"), { data: updated, updatedAt: Timestamp.now() });
      await logAudit("UPDATE_SETTINGS", { setting: "districtVillages" });
      cacheSet("districtVillages", updated);
      setDistrictVillages(updated);
      setDvDone("✓ Districts & villages saved successfully.");
    } catch (err) { setError(err.message); }
    finally { setDvSaving(false); }
  };

  const handleSelectDistrict = (name) => {
    setSelectedDistrict(name);
    const villages = districtVillages[name] || [];
    setEditingVillages(villages.join(", "));
    setDvDone("");
  };

  const handleSaveVillages = () => {
    const villages = editingVillages.split(",").map(v => v.trim()).filter(Boolean);
    const updated = { ...districtVillages, [selectedDistrict]: villages };
    saveDistrictVillages(updated);
  };

  const handleDeleteDistrict = (name) => {
    if (!window.confirm(`Delete district "${name}" and all its villages?`)) return;
    const updated = { ...districtVillages };
    delete updated[name];
    setSelectedDistrict("");
    setEditingVillages("");
    saveDistrictVillages(updated);
  };

  const handleAddDistrict = () => {
    const name = newDistrictName.trim().toUpperCase();
    if (!name) return;
    if (districtVillages[name]) { setError("District already exists."); return; }
    const updated = { ...districtVillages, [name]: [] };
    setDistrictVillages(updated);
    setNewDistrictName("");
    setSelectedDistrict(name);
    setEditingVillages("");
  };

  const fmtDate = (d) => {
    if (!d) return "—";
    if (d?.toDate) {
      const dt = d.toDate();
      return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
    }
    const s = String(d).split("T")[0];
    const parts = s.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2].padStart(2,"0")}/${parts[1].padStart(2,"0")}/${parts[0]}`;
    }
    const dt = new Date(d);
    if (isNaN(dt)) return "—";
    return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
  };

  const getBatchRecords = (batch) => {
    const batchTime = batch.timestamp instanceof Date ? batch.timestamp : new Date(batch.timestamp);
    const windowMs  = 5 * 60 * 1000;
    return records.filter(r => {
      if (!r.createdAt?.toDate) return false;
      const t = r.createdAt.toDate();
      return Math.abs(t - batchTime) < windowMs;
    });
  };

  const handleUndoImport = async () => {
    if (!selectedBatch) return;
    setDeleting(true); setProgress(0); setError(""); setConfirmOpen(false);
    const batchRecs = getBatchRecords(selectedBatch);
    let count = 0;
    for (let i = 0; i < batchRecs.length; i++) {
      try { await deleteDoc(doc(db, "registrations", batchRecs[i].id)); count++; }
      catch (err) { setError(`Error deleting record: ${err.message}`); }
      setProgress(Math.round(((i + 1) / batchRecs.length) * 100));
    }
    await logAudit("BULK_DELETE", { reason: "Undo import", file: selectedBatch.details?.file, count, undoneBy: auth.currentUser?.email });
    cacheClear("registrations");
    setDone(`✓ Undone: ${count} records from import "${selectedBatch.details?.file || "unknown"}" deleted.`);
    setSelectedBatch(null); setMode("home"); fetchData(); setDeleting(false);
  };

  const handleBulkDelete = async () => {
    setDeleting(true); setProgress(0); setError(""); setConfirmOpen(false);
    const ids = [...selectedIds]; let count = 0;
    for (let i = 0; i < ids.length; i++) {
      try { await deleteDoc(doc(db, "registrations", ids[i])); count++; }
      catch (err) { setError(`Error: ${err.message}`); }
      setProgress(Math.round(((i + 1) / ids.length) * 100));
    }
    await logAudit("BULK_DELETE", { reason: "Manual bulk delete", count, deletedBy: auth.currentUser?.email });
    cacheClear("registrations");
    setDone(`✓ ${count} records deleted.`);
    setSelectedIds(new Set()); setMode("home"); fetchData(); setDeleting(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = (filtered) => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(r => r.id)));
  };

  const filteredRecords = records.filter(r =>
    !searchTerm ||
    r.mataiTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.holderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.village?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const th = { background:"#155c31", color:"rgba(255,255,255,0.92)", padding:"0.75rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.15em", textTransform:"uppercase", textAlign:"left", whiteSpace:"nowrap" };
  const td = { padding:"0.75rem 1rem", fontSize:"0.87rem", borderBottom:"1px solid #e5e7eb", color:"#111827" };

  const sortedDistricts = Object.keys(districtVillages).sort();

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={auth.currentUser?.email} />
      <div className="sidebar-content">

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2rem" }}>
          <div>
            <p className="page-eyebrow">Administration</p>
            <h1 className="page-title">Data Management</h1>
          </div>
          {mode !== "home" && (
            <button className="btn-secondary" onClick={() => { setMode("home"); setSelectedIds(new Set()); setSelectedBatch(null); setSelectedDistrict(""); }}>
              ← Back
            </button>
          )}
        </div>

        {done  && <div className="alert alert-success" style={{ marginBottom:"1rem" }}>{done}</div>}
        {error && <div className="alert alert-error"   style={{ marginBottom:"1rem" }}>{error}</div>}

        {deleting && (
          <div className="card" style={{ textAlign:"center", padding:"2.5rem", marginBottom:"1.5rem" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.82rem", color:"#155c31", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:"1rem" }}>Deleting Records…</p>
            <div style={{ background:"#e8f5ed", borderRadius:"4px", height:"10px", overflow:"hidden", maxWidth:"400px", margin:"0 auto 1rem" }}>
              <div style={{ background:"#991b1b", height:"100%", width:`${progress}%`, transition:"width 0.2s", borderRadius:"4px" }} />
            </div>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2rem", color:"#991b1b" }}>{progress}%</p>
          </div>
        )}

        {/* ── HOME ── */}
        {mode === "home" && !deleting && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"1.5rem", marginBottom:"2rem" }}>

              <div className="card" style={{ borderLeft:"4px solid #d97706" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:"1rem", marginBottom:"1rem" }}>
                  <span style={{ fontSize:"2rem" }}>↩</span>
                  <div>
                    <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:"0.9rem", color:"#111827", marginBottom:"0.3rem" }}>Undo Import</h3>
                    <p style={{ fontSize:"0.85rem", color:"#6b7280", lineHeight:1.6 }}>Select a previous import session and delete all records from that batch.</p>
                  </div>
                </div>
                <button className="btn-primary" onClick={() => setMode("undo")} style={{ background:"#d97706", fontSize:"0.78rem", width:"100%" }}>View Import History</button>
              </div>

              <div className="card" style={{ borderLeft:"4px solid #991b1b" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:"1rem", marginBottom:"1rem" }}>
                  <span style={{ fontSize:"2rem" }}>🗑</span>
                  <div>
                    <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:"0.9rem", color:"#111827", marginBottom:"0.3rem" }}>Bulk Delete Records</h3>
                    <p style={{ fontSize:"0.85rem", color:"#6b7280", lineHeight:1.6 }}>Search and select records to permanently delete multiple entries.</p>
                  </div>
                </div>
                <button onClick={() => setMode("bulk")} style={{ background:"#991b1b", color:"#fff", border:"none", padding:"0.6rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.78rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"4px", cursor:"pointer", width:"100%" }}>Select Records to Delete</button>
              </div>

              <div className="card" style={{ borderLeft:"4px solid #2563eb" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:"1rem", marginBottom:"1rem" }}>
                  <span style={{ fontSize:"2rem" }}>🗺️</span>
                  <div>
                    <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:"0.9rem", color:"#111827", marginBottom:"0.3rem" }}>Districts & Villages</h3>
                    <p style={{ fontSize:"0.85rem", color:"#6b7280", lineHeight:1.6 }}>Add, edit or remove districts and their villages used in registration.</p>
                  </div>
                </div>
                <button onClick={() => { setMode("districts"); loadDistrictVillages(); }} style={{ background:"#2563eb", color:"#fff", border:"none", padding:"0.6rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.78rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"4px", cursor:"pointer", width:"100%" }}>Manage Districts</button>
              </div>

            </div>

            <div className="card">
              <h3 className="section-head">◈ Registry Summary</h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem" }}>
                {[
                  ["Total Records", records.length, "#155c31"],
                  ["Import Sessions", imports.length, "#d97706"],
                  ["Last Import", imports[0] ? fmtDate(imports[0].timestamp) : "None", "#6b7280"],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ textAlign:"center", padding:"1rem", background:"#f9fafb", borderRadius:"6px", border:"1px solid #e5e7eb" }}>
                    <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", color:"#6b7280", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.5rem" }}>{label}</p>
                    <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize: typeof val === "number" ? "2rem" : "0.85rem", color, fontWeight:"bold" }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── DISTRICTS & VILLAGES MODE ── */}
        {mode === "districts" && !deleting && (
          <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:"1.5rem", alignItems:"start" }}>

            {/* Left: district list */}
            <div className="card" style={{ padding:0, overflow:"hidden" }}>
              <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid #e5e7eb", background:"#f9fafb" }}>
                <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:"0.8rem", color:"#111827", marginBottom:"0.75rem" }}>◈ Districts ({sortedDistricts.length})</h3>
                <div style={{ display:"flex", gap:"0.5rem" }}>
                  <input type="text" value={newDistrictName} onChange={e => setNewDistrictName(e.target.value)}
                    placeholder="New district name…"
                    style={{ flex:1, padding:"0.4rem 0.6rem", border:"1.5px solid #d1d5db", borderRadius:"4px", fontSize:"0.8rem", fontFamily:"inherit" }} />
                  <button onClick={handleAddDistrict} style={{ background:"#155c31", color:"#fff", border:"none", padding:"0.4rem 0.75rem", borderRadius:"4px", cursor:"pointer", fontSize:"0.8rem", fontFamily:"'Cinzel',serif" }}>+ Add</button>
                </div>
              </div>
              {dvLoading ? (
                <p style={{ padding:"1rem", color:"#6b7280", fontSize:"0.85rem" }}>Loading…</p>
              ) : (
                <div style={{ maxHeight:"520px", overflowY:"auto" }}>
                  {sortedDistricts.map(name => (
                    <div key={name} onClick={() => handleSelectDistrict(name)}
                      style={{ padding:"0.65rem 1.25rem", cursor:"pointer", borderBottom:"1px solid #f3f4f6",
                        background: selectedDistrict === name ? "#e8f5ed" : "transparent",
                        borderLeft: selectedDistrict === name ? "3px solid #155c31" : "3px solid transparent",
                        transition:"all 0.1s" }}>
                      <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", color: selectedDistrict === name ? "#155c31" : "#374151", fontWeight: selectedDistrict === name ? "700" : "400" }}>{name}</p>
                      <p style={{ fontSize:"0.7rem", color:"#9ca3af", marginTop:"2px" }}>{(districtVillages[name] || []).length} villages</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: village editor */}
            <div>
              {dvDone && <div className="alert alert-success" style={{ marginBottom:"1rem" }}>{dvDone}</div>}
              {!selectedDistrict ? (
                <div className="card" style={{ textAlign:"center", padding:"3rem", color:"#9ca3af" }}>
                  <p style={{ fontSize:"2rem", marginBottom:"0.75rem" }}>🗺️</p>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.82rem" }}>Select a district to edit its villages</p>
                </div>
              ) : (
                <div className="card">
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
                    <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:"0.9rem", color:"#111827" }}>◈ {selectedDistrict}</h3>
                    <button onClick={() => handleDeleteDistrict(selectedDistrict)}
                      style={{ background:"#991b1b", color:"#fff", border:"none", padding:"0.4rem 0.9rem", borderRadius:"4px", cursor:"pointer", fontSize:"0.75rem", fontFamily:"'Cinzel',serif" }}>
                      Delete District
                    </button>
                  </div>
                  <p style={{ fontSize:"0.82rem", color:"#6b7280", marginBottom:"0.75rem", lineHeight:1.6 }}>
                    Enter villages separated by commas. Current: <strong>{(districtVillages[selectedDistrict] || []).length} villages</strong>
                  </p>
                  <textarea
                    value={editingVillages}
                    onChange={e => setEditingVillages(e.target.value)}
                    rows={8}
                    placeholder="Village 1, Village 2, Village 3…"
                    style={{ width:"100%", padding:"0.75rem", border:"1.5px solid #d1d5db", borderRadius:"4px", fontSize:"0.88rem", fontFamily:"inherit", resize:"vertical", boxSizing:"border-box" }}
                  />
                  <div style={{ marginTop:"0.5rem", marginBottom:"1rem" }}>
                    <p style={{ fontSize:"0.78rem", color:"#6b7280" }}>
                      Preview: {editingVillages.split(",").map(v => v.trim()).filter(Boolean).length} villages
                    </p>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"0.4rem", marginTop:"0.5rem" }}>
                      {editingVillages.split(",").map(v => v.trim()).filter(Boolean).map((v, i) => (
                        <span key={i} style={{ background:"#e8f5ed", color:"#155c31", padding:"2px 10px", borderRadius:"10px", fontSize:"0.75rem", fontFamily:"'Cinzel',serif" }}>{v}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleSaveVillages} disabled={dvSaving}
                    style={{ background:"#155c31", color:"#fff", border:"none", padding:"0.65rem 2rem", fontFamily:"'Cinzel',serif", fontSize:"0.78rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"4px", cursor:"pointer" }}>
                    {dvSaving ? "Saving…" : "Save Villages"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── UNDO IMPORT MODE ── */}
        {mode === "undo" && !deleting && (
          <div>
            <div className="card" style={{ marginBottom:"1.5rem", borderLeft:"4px solid #d97706" }}>
              <h3 className="section-head">◈ Import History</h3>
              <p style={{ fontSize:"0.85rem", color:"#374151", marginBottom:"1.25rem" }}>Select an import session below to preview the records it added, then confirm deletion.</p>
              {loading ? (
                <p style={{ color:"#6b7280", fontStyle:"italic" }}>Loading import history…</p>
              ) : imports.length === 0 ? (
                <p style={{ color:"#6b7280", fontStyle:"italic" }}>No import sessions found in the audit log.</p>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
                  {imports.map((batch) => {
                    const batchRecs = getBatchRecords(batch);
                    const isSelected = selectedBatch?.id === batch.id;
                    return (
                      <div key={batch.id} onClick={() => setSelectedBatch(isSelected ? null : batch)}
                        style={{ padding:"1rem 1.25rem", border:`2px solid ${isSelected ? "#d97706" : "#e5e7eb"}`, borderRadius:"6px", cursor:"pointer", background: isSelected ? "#fffbeb" : "#fff", transition:"all 0.15s" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div>
                            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.8rem", color:"#111827", fontWeight:"600" }}>📁 {batch.details?.file || "Unknown file"}</p>
                            <p style={{ fontSize:"0.8rem", color:"#6b7280", marginTop:"2px" }}>
                              {fmtDate(batch.timestamp)} · by {batch.userEmail} · <strong style={{ color:"#155c31" }}>{batch.details?.count || "?"} records imported</strong>
                              {batch.details?.skipped > 0 && <span style={{ color:"#991b1b" }}> · {batch.details.skipped} skipped</span>}
                            </p>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                            <span style={{ fontSize:"0.8rem", color:"#6b7280" }}>{batchRecs.length} records found in DB</span>
                            <div style={{ width:"20px", height:"20px", borderRadius:"50%", border:`2px solid ${isSelected ? "#d97706" : "#d1d5db"}`, background: isSelected ? "#d97706" : "transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {isSelected && <span style={{ color:"#fff", fontSize:"12px", lineHeight:1 }}>✓</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {selectedBatch && (() => {
              const batchRecs = getBatchRecords(selectedBatch);
              return (
                <div className="card" style={{ marginBottom:"1.5rem", borderColor:"#fca5a5" }}>
                  <h3 className="section-head" style={{ color:"#991b1b" }}>◈ Preview: {batchRecs.length} records will be deleted</h3>
                  <div style={{ overflowX:"auto", maxHeight:"300px", overflowY:"auto", marginBottom:"1rem" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead><tr>{["Matai Title","Holder Name","Village","District","Cert No."].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {batchRecs.map((r, i) => (
                          <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                            <td style={{ ...td, color:"#155c31", fontWeight:"700" }}>{r.mataiTitle}</td>
                            <td style={td}>{r.holderName || "—"}</td>
                            <td style={td}>{r.village || "—"}</td>
                            <td style={td}>{r.district || "—"}</td>
                            <td style={{ ...td, color:"#6b7280" }}>{r.mataiCertNumber || r.refNumber || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={() => setConfirmOpen("undo")} style={{ background:"#991b1b", color:"#fff", border:"none", padding:"0.65rem 2rem", fontFamily:"'Cinzel',serif", fontSize:"0.78rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"4px", cursor:"pointer" }}>
                    ↩ Undo This Import — Delete {batchRecs.length} Records
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── BULK DELETE MODE ── */}
        {mode === "bulk" && !deleting && (
          <div>
            <div className="card" style={{ marginBottom:"1.5rem" }}>
              <div style={{ display:"flex", gap:"1rem", alignItems:"center", marginBottom:"1rem" }}>
                <input type="text" placeholder="Search by title, name or village…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  style={{ flex:1, padding:"0.65rem 1rem", border:"1.5px solid #d1d5db", borderRadius:"4px", fontSize:"0.9rem", fontFamily:"inherit" }} />
                <button className="btn-secondary" onClick={() => toggleAll(filteredRecords)} style={{ fontSize:"0.78rem", whiteSpace:"nowrap" }}>
                  {selectedIds.size === filteredRecords.length && filteredRecords.length > 0 ? "Deselect All" : `Select All (${filteredRecords.length})`}
                </button>
                {selectedIds.size > 0 && (
                  <button onClick={() => setConfirmOpen("bulk")} style={{ background:"#991b1b", color:"#fff", border:"none", padding:"0.65rem 1.5rem", fontFamily:"'Cinzel',serif", fontSize:"0.78rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"4px", cursor:"pointer", whiteSpace:"nowrap" }}>
                    🗑 Delete {selectedIds.size} Selected
                  </button>
                )}
              </div>
              <p style={{ fontSize:"0.82rem", color:"#6b7280" }}>{selectedIds.size} of {filteredRecords.length} records selected{searchTerm && ` (filtered from ${records.length} total)`}</p>
            </div>
            <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:"6px", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX:"auto", maxHeight:"560px", overflowY:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead style={{ position:"sticky", top:0, zIndex:1 }}>
                    <tr>
                      <th style={{ ...th, width:"44px", textAlign:"center" }}>✓</th>
                      {["Matai Title","Holder Name","Village","District","Type","Cert No."].map(h => <th key={h} style={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length === 0 ? (
                      <tr><td colSpan={7} style={{ ...td, textAlign:"center", color:"#9ca3af", fontStyle:"italic" }}>No records found.</td></tr>
                    ) : filteredRecords.map((r, i) => {
                      const sel = selectedIds.has(r.id);
                      return (
                        <tr key={r.id} onClick={() => toggleSelect(r.id)} style={{ background: sel ? "#fef2f2" : i % 2 === 0 ? "#fff" : "#fafafa", cursor:"pointer", transition:"background 0.1s" }}>
                          <td style={{ ...td, textAlign:"center" }}>
                            <div style={{ width:"18px", height:"18px", borderRadius:"3px", border:`2px solid ${sel ? "#991b1b" : "#d1d5db"}`, background: sel ? "#991b1b" : "#fff", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                              {sel && <span style={{ color:"#fff", fontSize:"11px", lineHeight:1 }}>✓</span>}
                            </div>
                          </td>
                          <td style={{ ...td, color:"#155c31", fontWeight:"700" }}>{r.mataiTitle}</td>
                          <td style={td}>{r.holderName || "—"}</td>
                          <td style={td}>{r.village || "—"}</td>
                          <td style={td}>{r.district || "—"}</td>
                          <td style={td}><span style={{ background:"#e8f5ed", color:"#155c31", fontSize:"0.72rem", padding:"2px 8px", borderRadius:"10px", fontFamily:"'Cinzel',serif" }}>{r.mataiType || "—"}</span></td>
                          <td style={{ ...td, color:"#6b7280", fontSize:"0.82rem" }}>{r.mataiCertNumber || r.refNumber || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIRM DIALOG ── */}
        {confirmOpen && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#fff", borderRadius:"8px", padding:"2rem 2.5rem", maxWidth:"480px", width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize:"2.5rem", textAlign:"center", marginBottom:"1rem" }}>⚠️</div>
              <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:"1rem", color:"#111827", textAlign:"center", marginBottom:"0.75rem" }}>Confirm Permanent Deletion</h3>
              <p style={{ fontSize:"0.9rem", color:"#374151", textAlign:"center", lineHeight:1.7, marginBottom:"1.5rem" }}>
                {confirmOpen === "undo"
                  ? `You are about to delete ${getBatchRecords(selectedBatch).length} records from the import "${selectedBatch?.details?.file || "unknown"}". This cannot be undone.`
                  : `You are about to permanently delete ${selectedIds.size} selected record${selectedIds.size !== 1 ? "s" : ""}. This cannot be undone.`}
              </p>
              <div style={{ display:"flex", gap:"1rem", justifyContent:"center" }}>
                <button onClick={() => setConfirmOpen(false)} className="btn-secondary" style={{ fontSize:"0.82rem" }}>Cancel</button>
                <button onClick={confirmOpen === "undo" ? handleUndoImport : handleBulkDelete}
                  style={{ background:"#991b1b", color:"#fff", border:"none", padding:"0.65rem 1.8rem", fontFamily:"'Cinzel',serif", fontSize:"0.82rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"4px", cursor:"pointer" }}>
                  Yes, Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
