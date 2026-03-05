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

  const formatDate = (str) => {
    if (!str) return "—";
    return new Date(str).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--gold)", fontStyle: "italic" }}>Loading certificate…</div>
  );
  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: "1rem" }}>
      <p style={{ color: "#f5a0a0" }}>{error}</p>
      <Link to="/dashboard"><button className="btn-secondary">← Return to Registry</button></Link>
    </div>
  );

  return (
    <>
      {/* Screen Nav - hidden on print */}
      <nav className="no-print">
        <Link to="/dashboard" className="nav-brand">⬡ Matai Registry</Link>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">← Registry</Link>
          <Link to={`/register/${id}`} className="nav-link">Edit Record</Link>
          <button className="btn-logout" onClick={() => signOut(auth)}>Sign Out</button>
        </div>
      </nav>

      {/* Screen actions */}
      <div className="no-print" style={{ display: "flex", justifyContent: "center", gap: "1rem", padding: "2rem 1rem 1rem" }}>
        <button className="btn-primary" onClick={() => window.print()}>
          🖨 Print Certificate
        </button>
        <Link to="/dashboard"><button className="btn-secondary">← Back to Registry</button></Link>
      </div>

      {/* Certificate */}
      <div id="certificate-wrapper" style={{ display: "flex", justifyContent: "center", padding: "1rem 1rem 4rem" }}>
        <div id="certificate" style={{
          width: "794px",
          minHeight: "562px",
          background: "#fdf8f0",
          color: "#1a1208",
          position: "relative",
          fontFamily: "'EB Garamond', Georgia, serif",
          boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
          overflow: "hidden"
        }}>
          {/* Outer border */}
          <div style={{
            position: "absolute", inset: "12px",
            border: "2px solid #8b6914",
            pointerEvents: "none", zIndex: 1
          }} />
          {/* Inner border */}
          <div style={{
            position: "absolute", inset: "18px",
            border: "1px solid rgba(139,105,20,0.4)",
            pointerEvents: "none", zIndex: 1
          }} />

          {/* Corner ornaments */}
          {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h]) => (
            <svg key={`${v}${h}`} width="60" height="60" viewBox="0 0 60 60" fill="none"
              style={{ position: "absolute", [v]: 8, [h]: 8, transform: `rotate(${v==="bottom"?180:0}deg) scaleX(${h==="right"?-1:1})`, zIndex: 2 }}>
              <path d="M5 5 L25 5 L5 25 Z" fill="none" stroke="#8b6914" strokeWidth="1.5"/>
              <path d="M5 5 L15 5 L5 15 Z" fill="rgba(139,105,20,0.3)"/>
              <circle cx="30" cy="5" r="2" fill="#8b6914" opacity="0.5"/>
              <circle cx="5" cy="30" r="2" fill="#8b6914" opacity="0.5"/>
            </svg>
          ))}

          {/* Side patterns */}
          <div style={{
            position: "absolute", left: 28, top: 70, bottom: 70, width: 20,
            backgroundImage: "repeating-linear-gradient(180deg, transparent 0px, transparent 10px, rgba(139,105,20,0.15) 10px, rgba(139,105,20,0.15) 11px)",
            zIndex: 1
          }} />
          <div style={{
            position: "absolute", right: 28, top: 70, bottom: 70, width: 20,
            backgroundImage: "repeating-linear-gradient(180deg, transparent 0px, transparent 10px, rgba(139,105,20,0.15) 10px, rgba(139,105,20,0.15) 11px)",
            zIndex: 1
          }} />

          {/* Content area */}
          <div style={{ padding: "50px 80px", position: "relative", zIndex: 3, textAlign: "center" }}>

            {/* Header emblem */}
            <div style={{ marginBottom: "8px" }}>
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ margin: "0 auto" }}>
                <polygon points="40,4 76,22 76,58 40,76 4,58 4,22" stroke="#8b6914" strokeWidth="1.5" fill="rgba(139,105,20,0.05)" />
                <polygon points="40,14 66,28 66,52 40,66 14,52 14,28" stroke="#8b6914" strokeWidth="1" fill="none" opacity="0.5" />
                <circle cx="40" cy="40" r="14" fill="rgba(139,105,20,0.12)" stroke="#8b6914" strokeWidth="1" />
                <circle cx="40" cy="40" r="7" fill="#8b6914" opacity="0.7" />
                <circle cx="40" cy="40" r="3" fill="#fdf8f0" />
                {[0,60,120,180,240,300].map(a => (
                  <circle key={a} cx={40 + 20*Math.cos(a*Math.PI/180)} cy={40 + 20*Math.sin(a*Math.PI/180)} r="2.5" fill="#8b6914" opacity="0.4" />
                ))}
              </svg>
            </div>

            {/* Country label */}
            <p style={{ fontFamily: "'Cinzel', serif", fontSize: "9px", letterSpacing: "0.4em", color: "#8b6914", textTransform: "uppercase", marginBottom: "4px" }}>
              Independent State of Samoa
            </p>

            {/* Title */}
            <h1 style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: "26px", color: "#3d2800", marginBottom: "4px", letterSpacing: "0.03em" }}>
              Certificate of Registration
            </h1>
            <p style={{ fontFamily: "'Cinzel', serif", fontSize: "11px", letterSpacing: "0.25em", color: "#8b6914", textTransform: "uppercase", marginBottom: "20px" }}>
              Matai Title — Official Record
            </p>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, transparent, #8b6914)" }} />
              <span style={{ color: "#8b6914", fontSize: "16px" }}>✦</span>
              <div style={{ flex: 1, height: "1px", background: "linear-gradient(to left, transparent, #8b6914)" }} />
            </div>

            {/* Proclamation */}
            <p style={{ fontSize: "13px", color: "#4a3a1a", fontStyle: "italic", marginBottom: "16px", lineHeight: 1.6 }}>
              This is to certify that the Matai title of
            </p>

            {/* The title */}
            <div style={{
              background: "rgba(139,105,20,0.08)", border: "1px solid rgba(139,105,20,0.3)",
              borderRadius: "2px", padding: "12px 30px", marginBottom: "16px", display: "inline-block", minWidth: "60%"
            }}>
              <h2 style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: "30px", color: "#3d2800", letterSpacing: "0.04em", margin: 0 }}>
                {record.mataiTitle || "—"}
              </h2>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: "9px", letterSpacing: "0.25em", color: "#8b6914", textTransform: "uppercase", marginTop: "4px" }}>
                {record.mataiType} Title {record.familyName ? `· Āiga ${record.familyName}` : ""}
              </p>
            </div>

            <p style={{ fontSize: "13px", color: "#4a3a1a", fontStyle: "italic", marginBottom: "16px", lineHeight: 1.6 }}>
              has been duly conferred upon
            </p>

            <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: "20px", color: "#3d2800", marginBottom: "6px", letterSpacing: "0.05em" }}>
              {record.holderName || "—"}
            </h3>

            {/* Details row */}
            <div style={{ display: "flex", justifyContent: "center", gap: "40px", marginTop: "16px", marginBottom: "20px" }}>
              {[
                ["Village (Nu'u)", record.village || "—"],
                ["District (Itūmālō)", record.district || "—"],
                ["Date of Conferral", formatDate(record.dateConferred)]
              ].map(([label, value]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: "7px", letterSpacing: "0.2em", color: "#8b6914", textTransform: "uppercase", marginBottom: "3px" }}>{label}</p>
                  <p style={{ fontSize: "12px", color: "#3d2800", fontWeight: 500 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Second divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, transparent, #8b6914)" }} />
              <span style={{ color: "#8b6914", fontSize: "16px" }}>✦</span>
              <div style={{ flex: 1, height: "1px", background: "linear-gradient(to left, transparent, #8b6914)" }} />
            </div>

            {/* Signatures row */}
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", marginTop: "8px" }}>
              {/* Registrar */}
              <div style={{ textAlign: "center", minWidth: "180px" }}>
                <div style={{ borderBottom: "1px solid #8b6914", marginBottom: "6px", paddingBottom: "20px" }} />
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: "10px", color: "#3d2800", fontWeight: 600 }}>
                  {record.registrarName || "________________________________"}
                </p>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: "7px", letterSpacing: "0.15em", color: "#8b6914", textTransform: "uppercase", marginTop: "2px" }}>
                  {record.registrarTitle || "Registrar"}
                </p>
              </div>

              {/* Seal placeholder */}
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: "80px", height: "80px", borderRadius: "50%",
                  border: "2px dashed rgba(139,105,20,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto"
                }}>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: "7px", color: "rgba(139,105,20,0.5)", letterSpacing: "0.1em", textAlign: "center", lineHeight: 1.4 }}>
                    OFFICIAL<br/>SEAL
                  </p>
                </div>
              </div>

              {/* Witness */}
              <div style={{ textAlign: "center", minWidth: "180px" }}>
                <div style={{ borderBottom: "1px solid #8b6914", marginBottom: "6px", paddingBottom: "20px" }} />
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: "10px", color: "#3d2800", fontWeight: 600 }}>
                  ________________________________
                </p>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: "7px", letterSpacing: "0.15em", color: "#8b6914", textTransform: "uppercase", marginTop: "2px" }}>
                  Witness
                </p>
              </div>
            </div>

            {/* Registry number */}
            <p style={{ marginTop: "16px", fontFamily: "'Cinzel', serif", fontSize: "8px", letterSpacing: "0.2em", color: "rgba(139,105,20,0.5)", textTransform: "uppercase" }}>
              Registry No. {id?.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          #certificate-wrapper { padding: 0 !important; }
          #certificate { box-shadow: none !important; }
          @page { size: A4 landscape; margin: 0.5cm; }
        }
      `}</style>
    </>
  );
}
