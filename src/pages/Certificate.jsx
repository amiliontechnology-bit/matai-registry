import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";

export default function Certificate() {
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

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"var(--gold)", fontStyle:"italic" }}>Loading certificate…</div>
  );
  if (error) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", flexDirection:"column", gap:"1rem" }}>
      <p style={{ color:"#f5a0a0" }}>{error}</p>
      <Link to="/dashboard"><button className="btn-secondary">← Return to Registry</button></Link>
    </div>
  );

  return (
    <>
      <nav className="no-print">
        <Link to="/dashboard" className="nav-brand">⬡ Matai Registry</Link>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">← Registry</Link>
          <Link to={`/register/${id}`} className="nav-link">Edit Record</Link>
          <button className="btn-logout" onClick={() => signOut(auth)}>Sign Out</button>
        </div>
      </nav>

      <div className="no-print" style={{ display:"flex", justifyContent:"center", gap:"1rem", padding:"2rem 1rem 1rem" }}>
        <button className="btn-primary" onClick={() => window.print()}>🖨 Print Certificate</button>
        <Link to="/dashboard"><button className="btn-secondary">← Back to Registry</button></Link>
      </div>

      <div id="certificate-wrapper" style={{ display:"flex", justifyContent:"center", padding:"1rem 1rem 4rem" }}>
        <div id="certificate" style={{
          width:"794px", minHeight:"580px", background:"#fdf8f0", color:"#1a1208",
          position:"relative", fontFamily:"'EB Garamond', Georgia, serif",
          boxShadow:"0 20px 80px rgba(0,0,0,0.5)", overflow:"hidden"
        }}>
          {/* Borders */}
          <div style={{ position:"absolute", inset:"12px", border:"2px solid #8b6914", pointerEvents:"none", zIndex:1 }} />
          <div style={{ position:"absolute", inset:"18px", border:"1px solid rgba(139,105,20,0.4)", pointerEvents:"none", zIndex:1 }} />

          {/* Corner ornaments */}
          {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h]) => (
            <svg key={`${v}${h}`} width="60" height="60" viewBox="0 0 60 60" fill="none"
              style={{ position:"absolute", [v]:8, [h]:8, transform:`rotate(${v==="bottom"?180:0}deg) scaleX(${h==="right"?-1:1})`, zIndex:2 }}>
              <path d="M5 5 L25 5 L5 25 Z" fill="none" stroke="#8b6914" strokeWidth="1.5"/>
              <path d="M5 5 L15 5 L5 15 Z" fill="rgba(139,105,20,0.3)"/>
              <circle cx="30" cy="5" r="2" fill="#8b6914" opacity="0.5"/>
              <circle cx="5" cy="30" r="2" fill="#8b6914" opacity="0.5"/>
            </svg>
          ))}

          {/* Side patterns */}
          <div style={{ position:"absolute", left:28, top:70, bottom:70, width:20, backgroundImage:"repeating-linear-gradient(180deg,transparent 0,transparent 10px,rgba(139,105,20,0.15) 10px,rgba(139,105,20,0.15) 11px)", zIndex:1 }} />
          <div style={{ position:"absolute", right:28, top:70, bottom:70, width:20, backgroundImage:"repeating-linear-gradient(180deg,transparent 0,transparent 10px,rgba(139,105,20,0.15) 10px,rgba(139,105,20,0.15) 11px)", zIndex:1 }} />

          {/* Content */}
          <div style={{ padding:"40px 70px", position:"relative", zIndex:3 }}>

            {/* Reference number — top right */}
            <div style={{ position:"absolute", top:28, right:70, border:"1px solid #8b6914", padding:"3px 10px", fontFamily:"'Cinzel',serif", fontSize:"10px", color:"#8b6914", letterSpacing:"0.1em" }}>
              {record.refNumber || "___/___/___"}
            </div>

            {/* Emblem + heading — centred */}
            <div style={{ textAlign:"center", marginBottom:"12px" }}>
              <div style={{ width:"80px", height:"80px", margin:"0 auto 6px", borderRadius:"50%", border:"2px solid #8b6914", boxShadow:"0 0 0 4px rgba(139,105,20,0.15), 0 0 12px rgba(139,105,20,0.2)", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", background:"#fdf8f0" }}>
                <img src={process.env.PUBLIC_URL + "/mjca_logo.jpeg"} alt="MJCA Logo"
                  style={{ width:"76px", height:"76px", objectFit:"cover", borderRadius:"50%", filter:"sepia(20%) contrast(1.05)" }} />
              </div>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"7px", letterSpacing:"0.35em", color:"#8b6914", textTransform:"uppercase", marginBottom:"3px" }}>
                Independent State of Samoa
              </p>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8px", letterSpacing:"0.15em", color:"#5a3e00", textTransform:"uppercase", marginBottom:"4px" }}>
                Matagaluega o Faamasinoga ma le Faafoeina o Tulaga Tau Faamasinoga
              </p>
              <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"20px", color:"#3d2800", marginBottom:"3px" }}>
                Tusi Faamaonia o le Umia o le Suafa Matai
              </h1>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8px", letterSpacing:"0.2em", color:"#8b6914", textTransform:"uppercase" }}>
                Certificate of Registration — Matai Title
              </p>
            </div>

            {/* Divider */}
            <div style={{ display:"flex", alignItems:"center", gap:"10px", margin:"10px 0" }}>
              <div style={{ flex:1, height:"1px", background:"linear-gradient(to right,transparent,#8b6914)" }}/>
              <span style={{ color:"#8b6914", fontSize:"12px" }}>✦</span>
              <div style={{ flex:1, height:"1px", background:"linear-gradient(to left,transparent,#8b6914)" }}/>
            </div>

            {/* Afioga + Village */}
            <div style={{ marginBottom:"8px" }}>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"11px", color:"#8b6914", letterSpacing:"0.1em" }}>Afioga&nbsp;&nbsp;</span>
              <span style={{ fontSize:"15px", fontWeight:"bold", borderBottom:"1px solid #8b6914", paddingBottom:"1px", minWidth:"300px", display:"inline-block" }}>
                {record.holderName || ""}
              </span>
            </div>
            <div style={{ marginBottom:"14px" }}>
              <span style={{ fontSize:"14px", fontWeight:"bold", borderBottom:"1px solid #8b6914", paddingBottom:"1px", minWidth:"200px", display:"inline-block" }}>
                {record.village || ""}
              </span>
            </div>

            {/* Body text */}
            <div style={{ fontSize:"12.5px", lineHeight:"2.1", color:"#1a1208" }}>
              <div style={{ marginBottom:"2px" }}>
                Ua tuuina atu lenei Tusi Faamaoni e faailoa atu ai le avea o Oe o le nofo aloa'ia o le suafa&nbsp;
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #8b6914", paddingBottom:"1px", minWidth:"120px", display:"inline-block" }}>
                  {record.mataiTitle || ""}
                </span>
                {record.mataiType ? <span style={{ fontSize:"10px", color:"#8b6914", marginLeft:"6px" }}>({record.mataiType})</span> : ""}
              </div>

              <div style={{ display:"flex", alignItems:"baseline", flexWrap:"wrap", gap:"4px", marginBottom:"2px" }}>
                <span>o le nu'u o</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #8b6914", paddingBottom:"1px", minWidth:"110px", display:"inline-block", textAlign:"center" }}>{record.village || ""}</span>
                <span>i le Itumalo</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #8b6914", paddingBottom:"1px", minWidth:"150px", display:"inline-block", textAlign:"center" }}>{record.district || ""}</span>
                <span>ma na resitara i le</span>
              </div>

              <div style={{ display:"flex", alignItems:"baseline", gap:"4px", flexWrap:"wrap", marginBottom:"2px" }}>
                <span>aso</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #8b6914", minWidth:"35px", display:"inline-block", textAlign:"center" }}>
                  {record.dateRegistration ? new Date(record.dateRegistration).getDate() : ""}
                </span>
                <span>o</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #8b6914", minWidth:"90px", display:"inline-block", textAlign:"center" }}>
                  {record.dateRegistration ? ["Ianuari","Fepuari","Mati","Aperila","Me","Iuni","Iulai","Aokuso","Setema","Oketopa","Novema","Tesema"][new Date(record.dateRegistration).getMonth()] : ""}
                </span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #8b6914", minWidth:"55px", display:"inline-block", textAlign:"center" }}>
                  {record.dateRegistration ? new Date(record.dateRegistration).getFullYear() : ""}
                </span>
              </div>

              <div style={{ display:"flex", alignItems:"baseline", gap:"4px", flexWrap:"wrap" }}>
                <span>Tuuina atu i lenei aso</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #8b6914", minWidth:"35px", display:"inline-block", textAlign:"center" }}>
                  {record.dateIssued ? new Date(record.dateIssued).getDate() : ""}
                </span>
                <span>o</span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #8b6914", minWidth:"90px", display:"inline-block", textAlign:"center" }}>
                  {record.dateIssued ? ["Ianuari","Fepuari","Mati","Aperila","Me","Iuni","Iulai","Aokuso","Setema","Oketopa","Novema","Tesema"][new Date(record.dateIssued).getMonth()] : ""}
                </span>
                <span style={{ fontWeight:"bold", borderBottom:"1px solid #8b6914", minWidth:"55px", display:"inline-block", textAlign:"center" }}>
                  {record.dateIssued ? new Date(record.dateIssued).getFullYear() : ""}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div style={{ display:"flex", alignItems:"center", gap:"10px", margin:"12px 0" }}>
              <div style={{ flex:1, height:"1px", background:"linear-gradient(to right,transparent,#8b6914)" }}/>
              <span style={{ color:"#8b6914", fontSize:"12px" }}>✦</span>
              <div style={{ flex:1, height:"1px", background:"linear-gradient(to left,transparent,#8b6914)" }}/>
            </div>

            {/* Bottom row: extra info left, signature right */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>

              {/* Left: dates summary + seal */}
              <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                {record.dateConferred && (
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8px", color:"#8b6914", letterSpacing:"0.1em" }}>
                    Aso o le Saofai: <span style={{ color:"#3d2800", fontWeight:"bold" }}>{formatDate(record.dateConferred)}</span>
                  </p>
                )}
                {record.dateProclamation && (
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8px", color:"#8b6914", letterSpacing:"0.1em" }}>
                    Aso Faasalalau le Savali: <span style={{ color:"#3d2800", fontWeight:"bold" }}>{formatDate(record.dateProclamation)}</span>
                  </p>
                )}
                {record.familyName && (
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8px", color:"#8b6914", letterSpacing:"0.1em" }}>
                    Āiga: <span style={{ color:"#3d2800", fontWeight:"bold" }}>{record.familyName}</span>
                  </p>
                )}
                {/* Seal */}
                <div style={{ width:"70px", height:"70px", borderRadius:"50%", border:"2px dashed rgba(139,105,20,0.5)", display:"flex", alignItems:"center", justifyContent:"center", marginTop:"6px", flexDirection:"column" }}>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"6px", color:"rgba(139,105,20,0.6)", letterSpacing:"0.08em", textAlign:"center", lineHeight:1.4 }}>
                    FAAPOGAI<br/>OFFICIAL<br/>SEAL
                  </p>
                </div>
              </div>

              {/* Right: signature */}
              <div style={{ textAlign:"center", minWidth:"200px" }}>
                <div style={{ borderBottom:"1px solid #8b6914", marginBottom:"6px", paddingBottom:"28px" }}/>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"10px", color:"#3d2800", fontWeight:"600" }}>
                  {record.registrarName || ""}
                </p>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8px", letterSpacing:"0.12em", color:"#8b6914", textTransform:"uppercase", marginTop:"2px" }}>
                  {record.registrarTitle || "Resitara"}
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
          body { background: white !important; }
          #certificate-wrapper { padding: 0 !important; }
          #certificate { box-shadow: none !important; }
          @page { size: A4 portrait; margin: 0.5cm; }
        }
      `}</style>
    </>
  );
}
