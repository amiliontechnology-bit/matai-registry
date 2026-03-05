import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { logAudit } from "../utils/audit";
import { getPermissions } from "../utils/roles";

const DISTRICT_VILLAGES = {
  "AANA ALOFI Nu.03": ["FALEATIU","FASITOO-TAI","SATAPUALA","SATUIMALUFILUFI","VAILUUTAI"],
  "AANA ALOFI Nu.1": ["FALEASIU","FASITOOUTA"],
  "AANA ALOFI Nu.2": ["LEULUMOEGA","NOAFOALII"],
  "AIGA I LE TAI": ["APAI & SATUILAGI","APOLIMA TAI","APOLIMA UTA","FALEU TAI","FALEU UTA","FUAILOLOO","LALOVI MULIFANUA","LEPUAI","SALUA & SATOI"],
  "ALATAUA SISIFO": ["FALELIMA","NEIAFU","TUFUTAFOE"],
  "ALEIPATA ITUPA I LALO": ["AMAILE","LOTOPUE","MALAELA & MUTIATELE","SALEAAUMUA","SAMUSU","SATITOA","TIAVEA","UTUFAALALAFA"],
  "ALEIPATA ITUPA I LUGA": ["LALOMANU","ULUTOGIA","VAILOA ALEIPATA"],
  "ANOAMAA SASA'E": ["FALEFA","FALEVAO","LALOMAUGA","LUFILUFI","MANUNU","SALETELE","SAUANO"],
  "ANOAMAA SISIFO": ["EVA","FUSI","LEUSOALII","LUATUANUU","SALELESI","SAOLUAFATA","SOLOSOLO"],
  "FAASALELEAGA Nu 1": ["IVA","LALOMALAVA","SAFUA","SALELAVALU","SALELOLOGA","VAIAFAI","VAISAULU"],
  "FAASALELEAGA Nu 2": ["EVEEVE & VAIMAGA","FATAUSI","FOGAPOA & TUASIVI","FUSI & FUIFATU","SAPAPALII","TAPUELEELE"],
  "FAASALELEAGA Nu 3": ["MALAE & SALIMU","SAASAAI","SAIPIPI","SAPINI & LUUA","SIUFAGA"],
  "FAASALELEAGA Nu. 04": ["ASAGA","FALANAI","LANO","PUAPUA"],
  "FALEALILI": ["MALAEMALU & TAFATAFA","MATAUTU FALEALILI","POUTASI","SALANI","SALEILUA","SALESATELE","SAPOE / UTULAELAE","SAPUNAOA","SATALO","SIUNIU","VAOVAI"],
  "FALEALUPO": ["AVATA","VAOTUPUA"],
  "FALEATA SASA'E": ["LEPEA","VAILOA FALEATA","VAIMOSO"],
  "FALEATA SISIFO": ["SAINA","TOAMUA / PUIPAA","VAIGAGA","VAITELE","VAIUSU"],
  "GAGAEMAUGA Nu.01": ["LEAUVAA","LEMALU","MAUGA","PATAMEA","SAMALAEULU"],
  "GAGAEMAUGA Nu.02": ["SALAMUMU","SALEAULA"],
  "GAGAEMAUGA Nu.03": ["AVAO","FAGAMALO","LELEPA","SAFAI","SALEIA","SATOALEAPAI","VAIPOULI"],
  "GAGAIFOMAUGA Nu.03": ["AOPO","FAGAEE","LETUI","SASINA"],
  "GAGAIFOMAUGA Nu.1": ["MANASE","SAFOTU"],
  "GAGAIFOMAUGA Nu.2": ["FALETAGALOA","FATUVALU","LEFAGOALII","MATAVAI","PAIA","SAMAUGA"],
  "LEFAGA & FALEASEELA": ["FALEASEELA","GAGAIFOLEVAO","MATAFAA","MATAUTU LEFAGA","SAFAATOA","SAVAIA & TAFAGAMANU"],
  "LEPA": ["AUFAGA","LEPA & VAIGALU","SALEAPAGA & SIUPAPA"],
  "LOTOFAGA": ["LOTOFAGA","MATAUTU","VAVAU"],
  "PALAULI": ["FAALA","VAILOA","VAITOOMULI"],
  "PALAULI LE FALEFA": ["GATAIVAI","GAUTAVAI","PAPA PULEIA","PULEIA","SILI","TAFUA"],
  "PALAULI SISIFO": ["FOALALO","FOALUGA","SALAILUA","SATUIATUA","SIUTU","TAGA"],
  "SAFATA": ["FAUSAGA","FUSI","LOTOFAGA","MULIVAI","NIUSUATIA","SAANAPU","SATAOA","TAFITOALA","VAIEE"],
  "SAGAGA LE FALEFA": ["FALEULA","LEVI & ALAMUTU","LOTOSO'A","SALEPOUA'E & NONO'A","UTUALII & TUFULELE"],
  "SAGAGA LE USOGA": ["AFEGA","MALIE","TUANAI"],
  "SALEGA": ["FAGAFAU","FAIAAI","FOGASAVAII","FOGATULI","SAGONE","SAMATA- UTA","SAMATA-TAI","SIUVAO","VAIPUA"],
  "SAMATAU & FALELATAI": ["FALEVAI & SAMA'I","MATAUTU & LEVI","PATA","SAMATAU","SIUFAGA FALELATAI"],
  "SATUPAITEA": ["MOSULA","PITONUU","SATUFIA","VAEAGA"],
  "SIUMU": ["MANINOA","MATAFALA","SAAGA","SIUMU SASA'E"],
  "VAA O FONOTI": ["FALEAPUNA","LONA","MAASINA","MUSUMUSU & SALIMU","SAMAMEA","TAELEFAGA","UAFATO"],
  "VAIMAUFA SASA'E": ["FAGALII","LAULII","LETOGO","VAILELE"],
  "VAIMAUGA SISIFO": ["ALAMAGOTO","APIA","MAGIAGI","MATAUTU","MOATAA","TANUGAMANONO","VAIALA","VAILIMA"],
  "VAISIGANO Nu.02": ["FAGASA","PAPA SATAUA","SATAUA"],
  "VAISIGANO Nu.1": ["AUALA","MATAVAI ASAU","UTULOA ASAU","VAISALA"]
};

const MATAI_TYPES = ["Ali'i", "Faipule", "Tulafale"];

const EMPTY = {
  mataiTitle: "", holderName: "", gender: "", mataiType: "Ali'i",
  village: "", district: "",
  dateConferred: "", dateProclamation: "", dateRegistration: "", dateIssued: "",
  familyName: "", faapogai: "", refNumber: "",
  registrarName: "", registrarTitle: "", notes: ""
};

export default function Register({ userRole }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dupWarning, setDupWarning] = useState("");
  const isEdit = !!id;
  const perms = getPermissions(userRole);

  const villages = form.district ? DISTRICT_VILLAGES[form.district] || [] : [];

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "registrations", id));
        if (snap.exists()) setForm({ ...EMPTY, ...snap.data() });
      } catch { setError("Failed to load record."); }
      finally { setFetching(false); }
    })();
  }, [id]);

  const set = (field) => (e) => {
    const val = e.target.value;
    setForm(prev => ({
      ...prev,
      [field]: val,
      // Reset village when district changes
      ...(field === "district" ? { village: "" } : {})
    }));
  };

  // Check for duplicate Matai title
  const checkDuplicate = async (title) => {
    if (!title.trim()) return;
    try {
      const q = query(collection(db, "registrations"), where("mataiTitle", "==", title.trim()));
      const snap = await getDocs(q);
      const existing = snap.docs.filter(d => d.id !== id);
      if (existing.length > 0) {
        const rec = existing[0].data();
        setDupWarning(`⚠️ A registration for "${title}" already exists (holder: ${rec.holderName}). Please verify before proceeding.`);
      } else {
        setDupWarning("");
      }
    } catch { setDupWarning(""); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.mataiTitle.trim() || !form.holderName.trim()) {
      setError("Matai Title (Suafa Matai) and Untitled Name (Suafa Taulealea) are required.");
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await updateDoc(doc(db, "registrations", id), { ...form, updatedAt: serverTimestamp() });
        await logAudit("UPDATE", { mataiTitle: form.mataiTitle, recordId: id });
        setSuccess("Registration updated successfully.");
      } else {
        const docRef = await addDoc(collection(db, "registrations"), { ...form, createdAt: serverTimestamp() });
        await logAudit("CREATE", { mataiTitle: form.mataiTitle });
        setSuccess("Title registered successfully.");
        setTimeout(() => navigate(`/certificate/${docRef.id}`), 1200);
      }
    } catch (err) {
      setError("Failed to save. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sectionHead = (title) => (
    <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: "0.78rem", letterSpacing: "0.2em", color: "var(--gold)", textTransform: "uppercase", marginBottom: "1.5rem", opacity: 0.9 }}>
      ◈ {title}
    </h3>
  );

  if (fetching) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--gold)", fontStyle: "italic" }}>Loading…</div>
  );

  return (
    <div className="page">
      <div className="pattern-bg" />
      <nav>
        <Link to="/dashboard" className="nav-brand">⬡ Matai Registry</Link>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">← Registry</Link>
          <button className="btn-logout" onClick={() => signOut(auth)}>Sign Out</button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: "3rem 2.5rem", maxWidth: 800, margin: "0 auto", width: "100%", position: "relative" }}>
        <div className="fade-in" style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "'Cinzel', serif", fontSize: "0.72rem", letterSpacing: "0.25em", color: "var(--gold)", opacity: 0.7, textTransform: "uppercase", marginBottom: "0.5rem" }}>
            {isEdit ? "Edit Record" : "New Registration"}
          </p>
          <h2 style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: "1.8rem", color: "var(--cream)" }}>
            {isEdit ? "Update Matai Title" : "Register Matai Title"}
          </h2>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>{success}</div>}
        {dupWarning && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>{dupWarning}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

          {/* Title & Holder */}
          <div className="card fade-in-delay-1">
            {sectionHead("Title & Holder")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Matai Title (Suafa Matai) *</label>
                <input type="text" required value={form.mataiTitle}
                  onChange={set("mataiTitle")}
                  onBlur={e => checkDuplicate(e.target.value)}
                  placeholder="e.g. Faleolo, Tupua, Malietoa…" />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / 2" }}>
                <label>Untitled Name (Suafa Taulealea) *</label>
                <input type="text" required value={form.holderName} onChange={set("holderName")}
                  placeholder="Full name of person receiving the title" />
              </div>
              <div className="form-group" style={{ gridColumn: "2 / 3" }}>
                <label>Gender (Itūlagi)</label>
                <select value={form.gender} onChange={set("gender")}>
                  <option value="">— Select —</option>
                  <option>Tane (Male)</option>
                  <option>Fafine (Female)</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Title Type</label>
                <select value={form.mataiType} onChange={set("mataiType")}>
                  {MATAI_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Family Name (Āiga)</label>
                <input type="text" value={form.familyName} onChange={set("familyName")}
                  placeholder="Family / Āiga name" />
              </div>
            </div>
          </div>

          {/* Village & District */}
          <div className="card fade-in-delay-2">
            {sectionHead("Village & District")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
              <div className="form-group">
                <label>District (Itūmālō)</label>
                <select value={form.district} onChange={set("district")}>
                  <option value="">— Select District —</option>
                  {Object.keys(DISTRICT_VILLAGES).map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Village (Nu'u)</label>
                <select value={form.village} onChange={set("village")} disabled={!form.district}>
                  <option value="">— Select Village —</option>
                  {villages.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            {!form.district && (
              <p style={{ fontSize: "0.8rem", color: "rgba(201,168,76,0.5)", fontStyle: "italic", marginTop: "0.5rem" }}>
                Select a district first to see its villages
              </p>
            )}
          </div>

          {/* Dates */}
          <div className="card fade-in-delay-2">
            {sectionHead("Important Dates")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
              <div className="form-group">
                <label>Date of Conferral (Aso o le Saofai)</label>
                <input type="date" value={form.dateConferred} onChange={set("dateConferred")} />
              </div>
              <div className="form-group">
                <label>Date of Proclamation (Aso Faasalalau le Savali)</label>
                <input type="date" value={form.dateProclamation} onChange={set("dateProclamation")} />
              </div>
              <div className="form-group">
                <label>Date of Registration (Aso Resitala ai)</label>
                <input type="date" value={form.dateRegistration} onChange={set("dateRegistration")} />
              </div>
              <div className="form-group">
                <label>Date Issued (Aso Tuuina Mai)</label>
                <input type="date" value={form.dateIssued} onChange={set("dateIssued")} />
              </div>
            </div>
          </div>

          {/* Registrar & Seal */}
          <div className="card fade-in-delay-3">
            {sectionHead("Registrar & Seal (Faapogai)")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
              <div className="form-group">
                <label>Reference Number (e.g. 02/53/192)</label>
                <input type="text" value={form.refNumber} onChange={set("refNumber")}
                  placeholder="e.g. 02/53/192" />
              </div>
              <div className="form-group">
                <label>Registrar Name</label>
                <input type="text" value={form.registrarName} onChange={set("registrarName")} placeholder="Full name" />
              </div>
              <div className="form-group">
                <label>Registrar Title / Role</label>
                <input type="text" value={form.registrarTitle} onChange={set("registrarTitle")} placeholder="e.g. District Registrar" />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Seal Reference (Faapogai)</label>
                <input type="text" value={form.faapogai} onChange={set("faapogai")} placeholder="e.g. Official Seal No. 001" />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Notes (optional)</label>
                <textarea rows={3} value={form.notes} onChange={set("notes")}
                  placeholder="Any additional notes…" style={{ resize: "vertical" }} />
              </div>
            </div>
          </div>

          <div className="fade-in-delay-4" style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
            <Link to="/dashboard"><button type="button" className="btn-secondary">Cancel</button></Link>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Update Registration" : "Register & Generate Certificate"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
