import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError("Invalid credentials. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f0f2f0",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Subtle pattern */}
      <div className="pattern-bg" />

      {/* Background glow */}
      <div style={{
        position: "absolute", width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(21,92,49,0.08) 0%, transparent 70%)",
        top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none"
      }} />

      {/* Login card */}
      <div className="fade-in" style={{ position: "relative", width: "100%", maxWidth: 420, padding: "0 1.5rem" }}>

        {/* Logo & title */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: "1rem" }}>
            <polygon points="32,4 60,20 60,44 32,60 4,44 4,20" stroke="#155c31" strokeWidth="1.5" fill="none" opacity="0.5"/>
            <polygon points="32,12 52,24 52,40 32,52 12,40 12,24" stroke="#155c31" strokeWidth="1" fill="none" opacity="0.3"/>
            <circle cx="32" cy="32" r="8" fill="#155c31" opacity="0.9"/>
            <circle cx="32" cy="32" r="3.5" fill="#f0f2f0"/>
          </svg>
          <h1 style={{ fontFamily:"'Cinzel Decorative', serif", fontSize:"1.4rem", color:"#155c31", letterSpacing:"0.05em", marginBottom:"0.3rem" }}>
            Matai Registry
          </h1>
          <p style={{ fontFamily:"'Cinzel', serif", fontSize:"0.65rem", color:"#6b7280", letterSpacing:"0.25em", textTransform:"uppercase" }}>
            Resitalaina o Matai
          </p>
        </div>

        {/* Card */}
        <div style={{ background:"#ffffff", border:"1px solid #d1d5db", borderRadius:"8px", padding:"2.5rem", boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>

          {/* Divider label */}
          <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"2rem" }}>
            <div style={{ flex:1, height:"1px", background:"#e5e7eb" }}/>
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.2em", color:"#6b7280", textTransform:"uppercase", whiteSpace:"nowrap" }}>
              Secure Access
            </span>
            <div style={{ flex:1, height:"1px", background:"#e5e7eb" }}/>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom:"1.5rem" }}>{error}</div>
          )}

          <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email" type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="administrator@example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password" type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}
              style={{ marginTop:"0.5rem", width:"100%", padding:"0.85rem" }}>
              {loading ? "Authenticating…" : "Sign In to Registry"}
            </button>
          </form>
        </div>

        <p style={{ textAlign:"center", marginTop:"1.5rem", fontSize:"0.75rem", color:"#9ca3af", fontStyle:"italic" }}>
          Access restricted to authorised users only.
        </p>
      </div>
    </div>
  );
}
