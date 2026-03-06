import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";

export default function Certificate({ userRole }) {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "registrations", id));
        if (snap.exists()) setRecord({ id: snap.id, ...snap.data() });
        else setError("Record not found.");
      } catch { setError("Failed to load certificate."); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const MONTHS_SA = ["Ianuari","Fepuari","Mati","Aperila","Me","Iuni","Iulai","Aokuso","Setema","Oketopa","Novema","Tesema"];
  const formatDate = (str) => {
    if (!str) return "—";
    const d = new Date(str);
    return `${d.getDate()} ${MONTHS_SA[d.getMonth()]} ${d.getFullYear()}`;
  };

  const perms = getPermissions(userRole);

  const handlePrint = () => {
    logAudit("PRINT", { mataiTitle: record?.mataiTitle, recordId: id });
    window.print();
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"#1e6b3c", fontStyle:"italic" }}>Loading certificate…</div>
  );
  if (error) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", flexDirection:"column", gap:"1rem" }}>
      <p style={{ color:"#8b1a1a" }}>{error}</p>
      <Link to="/dashboard"><button className="btn-secondary">← Return to Registry</button></Link>
    </div>
  );

  // Afioga line: mataiTitle + holderName
  const afiogaName = [record.mataiTitle, record.holderName].filter(Boolean).join(" ");

  return (
    <>
      {/* Toolbar — hidden on print */}
      <div className="no-print" style={{ background:"#0f2e1a", borderBottom:"1px solid rgba(255,255,255,0.1)", padding:"0.85rem 2rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
          <Link to="/dashboard" style={{ color:"rgba(255,255,255,0.6)", textDecoration:"none", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em" }}>
            ← Registry
          </Link>
          <Link to={`/register/${id}`} style={{ color:"rgba(255,255,255,0.6)", textDecoration:"none", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em" }}>
            ✎ Edit Record
          </Link>
        </div>
        <div style={{ display:"flex", gap:"0.75rem" }}>
          {perms.canPrint && <button onClick={handlePrint} style={{
            background:"linear-gradient(135deg,#14482a,#1e6b3c,#2d9b57)", color:"#fff", border:"none",
            padding:"0.6rem 1.5rem", fontFamily:"'Cinzel',serif", fontSize:"0.75rem",
            fontWeight:"700", letterSpacing:"0.12em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer"
          }}>
            🖨 Print / Save PDF
          </button>
        </div>
      </div>

      {/* Certificate */}
      <div id="certificate-wrapper" style={{ display:"flex", justifyContent:"center", padding:"2rem 1rem 4rem", background:"#f7f4ef" }}>
        <div id="certificate" style={{
          width:"794px", minHeight:"600px", background:"#fdf8f0", color:"#1a1208",
          position:"relative", fontFamily:"'EB Garamond', Georgia, serif",
          boxShadow:"0 20px 80px rgba(0,0,0,0.25)", overflow:"hidden"
        }}>
          {/* Double border */}
          <div style={{ position:"absolute", inset:"12px", border:"2px solid #1a5c35", pointerEvents:"none", zIndex:1 }} />
          <div style={{ position:"absolute", inset:"18px", border:"1px solid rgba(26,92,53,0.4)", pointerEvents:"none", zIndex:1 }} />

          {/* Corner ornaments */}
          {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h]) => (
            <svg key={`${v}${h}`} width="60" height="60" viewBox="0 0 60 60" fill="none"
              style={{ position:"absolute", [v]:8, [h]:8, transform:`rotate(${v==="bottom"?180:0}deg) scaleX(${h==="right"?-1:1})`, zIndex:2 }}>
              <path d="M5 5 L25 5 L5 25 Z" fill="none" stroke="#1a5c35" strokeWidth="1.5"/>
              <path d="M5 5 L15 5 L5 15 Z" fill="rgba(26,92,53,0.3)"/>
              <circle cx="30" cy="5" r="2" fill="#1a5c35" opacity="0.5"/>
              <circle cx="5" cy="30" r="2" fill="#1a5c35" opacity="0.5"/>
            </svg>
          ))}

          {/* Side patterns */}
          <div style={{ position:"absolute", left:28, top:70, bottom:70, width:20, backgroundImage:"repeating-linear-gradient(180deg,transparent 0,transparent 10px,rgba(26,92,53,0.15) 10px,rgba(26,92,53,0.15) 11px)", zIndex:1 }} />
          <div style={{ position:"absolute", right:28, top:70, bottom:70, width:20, backgroundImage:"repeating-linear-gradient(180deg,transparent 0,transparent 10px,rgba(26,92,53,0.15) 10px,rgba(26,92,53,0.15) 11px)", zIndex:1 }} />

          {/* Content */}
          <div style={{ padding:"40px 70px", position:"relative", zIndex:3 }}>

            {/* Reference number top right */}
            <div style={{ position:"absolute", top:28, right:70, border:"1px solid #1a5c35", padding:"3px 10px", fontFamily:"'Cinzel',serif", fontSize:"10px", color:"#1a5c35", letterSpacing:"0.1em" }}>
              {record.mataiCertNumber || record.refNumber || "___/___/___"}
            </div>

            {/* Logo + headings */}
            <div style={{ textAlign:"center", marginBottom:"12px" }}>
              <div style={{ width:"90px", height:"90px", margin:"0 auto 6px", background:"transparent" }}>
                <img src={process.env.PUBLIC_URL + "/emblem.png"} alt="Samoa Emblem"
                  style={{ width:"76px", height:"76px", objectFit:"contain", borderRadius:"0" }} />
              </div>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"7px", letterSpacing:"0.35em", color:"#1a5c35", textTransform:"uppercase", marginBottom:"3px" }}>
                Independent State of Samoa
              </p>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8px", letterSpacing:"0.15em", color:"#5a3e00", textTransform:"uppercase", marginBottom:"4px" }}>
                Matagaluega o Faamasinoga ma le Faafoeina o Tulaga Tau Faamasinoga
              </p>
              <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"20px", color:"#3d2800", marginBottom:"3px" }}>
                Tusi Faamaonia o le Umia o le Suafa Matai
              </h1>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8px", letterSpacing:"0.2em", color:"#1a5c35", textTransform:"uppercase" }}>
                Certificate of Registration — Matai Title
              </p>
            </div>

            {/* Divider */}
            <div style={{ display:"flex", alignItems:"center", gap:"10px", margin:"10px 0" }}>
              <div style={{ flex:1, height:"1px", background:"linear-gradient(to right,transparent,#1a5c35)" }}/>
              <span style={{ color:"#1a5c35", fontSize:"12px" }}>✦</span>
              <div style={{ flex:1, height:"1px", background:"linear-gradient(to left,transparent,#1a5c35)" }}/>
            </div>

            {/* Afioga line — mataiTitle + holderName */}
            <div style={{ marginBottom:"8px" }}>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"11px", color:"#1a5c35", letterSpacing:"0.1em" }}>Afioga&nbsp;&nbsp;</span>
              <span style={{ fontSize:"16px", fontWeight:"bold", borderBottom:"1px solid #1a5c35", paddingBottom:"1px", minWidth:"300px", display:"inline-block" }}>
                {afiogaName}
              </span>
            </div>

            {/* Village line */}
            <div style={{ marginBottom:"14px" }}>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"11px", color:"#1a5c35", letterSpacing:"0.1em" }}>o le Nu'u o&nbsp;&nbsp;</span>
              <span style={{ fontSize:"14px", fontWeight:"bold", borderBottom:"1px solid #1a5c35", paddingBottom:"1px", minWidth:"200px", display:"inline-block" }}>
                {record.village || ""}
              </span>
            </div>

            {/* Body text */}
            <div style={{ fontSize:"12.5px", lineHeight:"2.1", color:"#1a1208" }}>
              <div style={{ marginBottom:"2px" }}>
                Ua tuuina atu lenei Tusi Faamaoni e faailoa atu ai le avea o Oe o le nofo aloa'ia o le suafa&nbsp;
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #1a5c35", paddingBottom:"1px", minWidth:"120px", display:"inline-block" }}>
                  {record.mataiTitle || ""}
                </span>
                {record.mataiType ? <span style={{ fontSize:"10px", color:"#1a5c35", marginLeft:"6px" }}>({record.mataiType})</span> : ""}
              </div>

              <div style={{ display:"flex", alignItems:"baseline", flexWrap:"wrap", gap:"4px", marginBottom:"2px" }}>
                <span>o le nu'u o</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #1a5c35", paddingBottom:"1px", minWidth:"110px", display:"inline-block", textAlign:"center" }}>{record.village || ""}</span>
                <span>i le Itumalo</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #1a5c35", paddingBottom:"1px", minWidth:"150px", display:"inline-block", textAlign:"center" }}>{record.district || ""}</span>
                <span>ma na resitara i le</span>
              </div>

              <div style={{ display:"flex", alignItems:"baseline", gap:"4px", flexWrap:"wrap", marginBottom:"2px" }}>
                <span>aso</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #1a5c35", minWidth:"35px", display:"inline-block", textAlign:"center" }}>
                  {record.dateRegistration ? new Date(record.dateRegistration).getDate() : ""}
                </span>
                <span>o</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #1a5c35", minWidth:"90px", display:"inline-block", textAlign:"center" }}>
                  {record.dateRegistration ? MONTHS_SA[new Date(record.dateRegistration).getMonth()] : ""}
                </span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #1a5c35", minWidth:"55px", display:"inline-block", textAlign:"center" }}>
                  {record.dateRegistration ? new Date(record.dateRegistration).getFullYear() : ""}
                </span>
              </div>

              <div style={{ display:"flex", alignItems:"baseline", gap:"4px", flexWrap:"wrap" }}>
                <span>Tuuina atu i lenei aso</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #1a5c35", minWidth:"35px", display:"inline-block", textAlign:"center" }}>
                  {record.dateIssued ? new Date(record.dateIssued).getDate() : ""}
                </span>
                <span>o</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #1a5c35", minWidth:"90px", display:"inline-block", textAlign:"center" }}>
                  {record.dateIssued ? MONTHS_SA[new Date(record.dateIssued).getMonth()] : ""}
                </span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #1a5c35", minWidth:"55px", display:"inline-block", textAlign:"center" }}>
                  {record.dateIssued ? new Date(record.dateIssued).getFullYear() : ""}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div style={{ display:"flex", alignItems:"center", gap:"10px", margin:"14px 0" }}>
              <div style={{ flex:1, height:"1px", background:"linear-gradient(to right,transparent,#1a5c35)" }}/>
              <span style={{ color:"#1a5c35", fontSize:"12px" }}>✦</span>
              <div style={{ flex:1, height:"1px", background:"linear-gradient(to left,transparent,#1a5c35)" }}/>
            </div>

            {/* Bottom row */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>

              {/* Left: dates + faapogai text */}
              <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
                {record.dateConferred && (
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8.5px", color:"#1a5c35", letterSpacing:"0.1em" }}>
                    Aso o le Saofai: <span style={{ color:"#3d2800", fontWeight:"bold" }}>{formatDate(record.dateConferred)}</span>
                  </p>
                )}
                {record.dateProclamation && (
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8.5px", color:"#1a5c35", letterSpacing:"0.1em" }}>
                    Aso Faasalalau le Savali: <span style={{ color:"#3d2800", fontWeight:"bold" }}>{formatDate(record.dateProclamation)}</span>
                  </p>
                )}
                {/* Faapogai as text field — not a seal */}
                {record.faapogai && (
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8.5px", color:"#1a5c35", letterSpacing:"0.1em", marginTop:"4px" }}>
                    Faapogai: <span style={{ color:"#3d2800", fontWeight:"bold" }}>{record.faapogai}</span>
                  </p>
                )}
              </div>

              {/* Right: registrar — hardcoded, not from form */}
              <div style={{ textAlign:"center", minWidth:"220px" }}>
                <div style={{ borderBottom:"1px solid #1a5c35", marginBottom:"6px", paddingBottom:"32px" }}/>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"9px", letterSpacing:"0.12em", color:"#1a5c35", textTransform:"uppercase", marginTop:"2px" }}>
                  Resitara
                </p>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"9px", color:"#3d2800", marginTop:"4px" }}>
                  Mo le: <strong>RESITARA</strong>
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          #certificate-wrapper { padding: 0 !important; background: white !important; }
          #certificate { box-shadow: none !important; }
          @page { size: A4 portrait; margin: 0.5cm; }
        }
      `}</style>
    </>
  );
}
