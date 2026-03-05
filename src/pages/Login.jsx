import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Invalid credentials. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <div className="pattern-bg" />

      {/* Background glow */}
      <div style={{
        position: "absolute", width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)",
        top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none"
      }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 440, padding: "0 1.5rem" }}>

        {/* Logo mark */}
        <div className="fade-in" style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: "1rem" }}>
            <polygon points="32,4 60,20 60,44 32,60 4,44 4,20" stroke="#c9a84c" strokeWidth="1.5" fill="none" opacity="0.6" />
            <polygon points="32,12 52,24 52,40 32,52 12,40 12,24" stroke="#c9a84c" strokeWidth="1" fill="none" opacity="0.4" />
            <circle cx="32" cy="32" r="8" fill="#c9a84c" opacity="0.9" />
            <circle cx="32" cy="32" r="4" fill="#0a0a0a" />
          </svg>
          <h1 className="fade-in-delay-1" style={{
            fontFamily: "'Cinzel Decorative', serif",
            fontSize: "1.4rem",
            color: "#c9a84c",
            letterSpacing: "0.05em",
            marginBottom: "0.35rem"
          }}>
            Matai Registry
          </h1>
          <p className="fade-in-delay-2" style={{ color: "rgba(245,237,224,0.5)", fontSize: "0.85rem", fontStyle: "italic" }}>
            Sacred Titles of Samoa
          </p>
        </div>

        <div className="card fade-in-delay-2" style={{ padding: "2.5rem" }}>
          <div className="divider" style={{ marginBottom: "2rem" }}>
            <span style={{ fontFamily: "'Cinzel', serif", fontSize: "0.7rem", letterSpacing: "0.2em" }}>SECURE ACCESS</span>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email" type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="administrator@example.com"
                style={{ color: "var(--cream)" }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password" type="password" required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: "0.5rem", width: "100%" }}>
              {loading ? "Authenticating…" : "Sign In to Registry"}
            </button>
          </form>
        </div>

        <p className="fade-in-delay-4" style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.78rem", color: "rgba(245,237,224,0.3)", fontStyle: "italic" }}>
          Access restricted to authorised administrators only.
        </p>
      </div>
    </div>
  );
}
