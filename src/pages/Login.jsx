import { useState } from "react";
import { signInWithEmailAndPassword, getMultiFactorResolver, TotpMultiFactorGenerator } from "firebase/auth";
import { app, auth } from "../firebase";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function Login() {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  // MFA challenge state
  const [mfaResolver, setMfaResolver] = useState(null);
  const [mfaCode, setMfaCode]         = useState("");
  const [mfaLoading, setMfaLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = err.code || "";
      // MFA required — show second factor prompt
      if (code === "auth/multi-factor-auth-required") {
        const resolver = getMultiFactorResolver(auth, err);
        setMfaResolver(resolver);
        setLoading(false);
        return;
      }
      // Account locked — blocked by beforeSignIn function
      if (code === "auth/blocking-cloud-function-returned-errors" ||
          (err.message && err.message.includes("ACCOUNT_LOCKED"))) {
        setError("Your account has been locked after too many failed attempts. Please contact your System Administrator to unlock your account.");
      } else if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        // Record the failed attempt
        try {
          const fns = getFunctions(app, "australia-southeast1");
          const recordFailed = httpsCallable(fns, "recordFailedLogin");
          const result = await recordFailed({ email: email.trim() });
          if (result.data?.lockedOut) {
            setError("Your account has been locked after too many failed attempts. Please contact your System Administrator to unlock your account.");
          } else if (result.data?.attemptsRemaining > 0) {
            setError(`Invalid email or password. ${result.data.attemptsRemaining} attempt${result.data.attemptsRemaining === 1 ? "" : "s"} remaining before your account is locked.`);
          } else {
            setError("Invalid email or password. Please try again.");
          }
        } catch {
          setError("Invalid email or password. Please try again.");
        }
      } else if (code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please wait a few minutes before trying again.");
      } else if (code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection.");
      } else if (code === "auth/invalid-email") {
        setError("Invalid email format. Please check your email address.");
      } else {
        setError(`Sign-in failed: ${err.code || err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    if (mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(""); setMfaLoading(true);
    try {
      const hint      = mfaResolver.hints[0];
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, mfaCode);
      await mfaResolver.resolveSignIn(assertion);
    } catch (err) {
      if (err.code === "auth/invalid-verification-code") {
        setError("Incorrect code. Please check your authenticator app and try again.");
      } else {
        setError(`Verification failed: ${err.message}`);
      }
    } finally {
      setMfaLoading(false);
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
          <img src={"/emblem.png"} alt="Samoa Emblem"
            style={{ width: "90px", height: "auto", objectFit: "contain", marginBottom: "1rem", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))" }} />
          <h1 style={{ fontFamily:"'Cinzel Decorative', serif", fontSize:"1.4rem", color:"#155c31", letterSpacing:"0.05em", marginBottom:"0.3rem" }}>
            Samoa Matai Registry
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

          {mfaResolver ? (
            /* ── MFA Challenge ── */
            <form onSubmit={handleMfaVerify} style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>
              <div style={{ background:"#f0faf4", border:"1px solid #c3e6cb", borderRadius:"4px", padding:"0.9rem 1rem", fontSize:"0.82rem", color:"#1a5c35" }}>
                <strong>🔐 Second factor required</strong><br />
                Open your authenticator app and enter the 6-digit code for <strong>Samoa Matai Registry</strong>.
              </div>
              <div className="form-group">
                <label htmlFor="mfaCode">Authenticator Code</label>
                <input
                  id="mfaCode" type="text" inputMode="numeric" maxLength={6}
                  value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" autoFocus autoComplete="one-time-code"
                  style={{ letterSpacing:"0.4em", textAlign:"center", fontSize:"1.3rem", fontFamily:"monospace" }}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={mfaLoading || mfaCode.length !== 6}
                style={{ marginTop:"0.5rem", width:"100%", padding:"0.85rem" }}>
                {mfaLoading ? "Verifying…" : "✓ Verify & Sign In"}
              </button>
              <button type="button" onClick={() => { setMfaResolver(null); setMfaCode(""); setError(""); }}
                style={{ background:"transparent", border:"none", color:"#9ca3af", cursor:"pointer", fontSize:"0.8rem" }}>
                ← Back to sign in
              </button>
            </form>
          ) : (
            /* ── Standard Login ── */
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
          )}
        </div>

        <p style={{ textAlign:"center", marginTop:"1.5rem", fontSize:"0.75rem", color:"#9ca3af", fontStyle:"italic" }}>
          Access restricted to authorised users only.
        </p>
      </div>
    </div>
  );
}
