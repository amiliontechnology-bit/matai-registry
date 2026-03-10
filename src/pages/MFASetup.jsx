import { useState, useEffect } from "react";
import { multiFactor, TotpMultiFactorGenerator } from "firebase/auth";
import { auth } from "../firebase";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";

export default function MFASetup({ userRole }) {
  const [step, setStep]             = useState("check"); // check | enrol | verify | done | already
  const [totpSecret, setTotpSecret] = useState(null);
  const [qrUrl, setQrUrl]           = useState("");
  const [manualKey, setManualKey]   = useState("");
  const [code, setCode]             = useState("");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const mfaUser = multiFactor(user);
    if (mfaUser.enrolledFactors && mfaUser.enrolledFactors.length > 0) {
      setStep("already");
    } else {
      setStep("enrol");
    }
  }, [user]);

  const startEnrolment = async () => {
    setError(""); setLoading(true);
    try {
      const mfaUser   = multiFactor(user);
      const session   = await mfaUser.getSession();
      const secret    = await TotpMultiFactorGenerator.generateSecret(session);
      const issuer    = "Samoa Matai Registry";
      const account   = user.email;
      const uri       = secret.generateQrCodeUrl(account, issuer);
      setTotpSecret(secret);
      setManualKey(secret.secretKey);
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`);
      setStep("verify");
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        setError("For security, please sign out and sign back in before setting up MFA.");
      } else {
        setError(err.message || "Failed to start MFA setup. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnrol = async () => {
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(""); setLoading(true);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, code);
      await multiFactor(user).enroll(assertion, "Authenticator App");
      await logAudit("MFA_ENROLLED", { method: "totp" });
      setStep("done");
    } catch (err) {
      if (err.code === "auth/invalid-verification-code") {
        setError("Incorrect code. Make sure your device time is correct and try again.");
      } else {
        setError(err.message || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const unenrol = async () => {
    if (!window.confirm("Are you sure you want to remove MFA from your account? This reduces your account security.")) return;
    setLoading(true);
    try {
      const mfaUser = multiFactor(user);
      const factor  = mfaUser.enrolledFactors[0];
      await mfaUser.unenroll(factor);
      await logAudit("MFA_UNENROLLED", { method: "totp" });
      setStep("enrol");
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        setError("For security, please sign out and sign back in before removing MFA.");
      } else {
        setError(err.message || "Failed to remove MFA.");
      }
    } finally {
      setLoading(false);
    }
  };

  const sCard = {
    background: "#fff",
    border: "1px solid rgba(30,107,60,0.2)",
    borderRadius: "6px",
    padding: "2rem",
    maxWidth: 520,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  };

  const renderContent = () => {
    if (step === "check") return <p style={{ color: "#888", fontStyle: "italic" }}>Checking MFA status…</p>;

    if (step === "already") {
      const mfaUser = multiFactor(user);
      const factor  = mfaUser.enrolledFactors[0];
      return (
        <>
          <div style={{ background: "#f0faf4", border: "1px solid #c3e6cb", borderRadius: "4px", padding: "1rem 1.2rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>✅</span>
            <div>
              <p style={{ fontWeight: 600, color: "#1a5c35", marginBottom: "2px" }}>MFA is active on your account</p>
              <p style={{ fontSize: "0.82rem", color: "#555" }}>
                Enrolled: <strong>{factor?.displayName || "Authenticator App"}</strong>
                {factor?.enrollmentTime && <> &nbsp;·&nbsp; {new Date(factor.enrollmentTime).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</>}
              </p>
            </div>
          </div>
          <p style={{ fontSize: "0.82rem", color: "#666", marginBottom: "1.5rem" }}>
            Your account is protected with a second factor. Each time you sign in, you will need to enter a 6-digit code from your authenticator app in addition to your password.
          </p>
          <button onClick={unenrol} disabled={loading}
            style={{ background: "transparent", border: "1px solid #8b1a1a", color: "#8b1a1a", padding: "0.5rem 1.2rem", borderRadius: "3px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Cinzel',serif", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {loading ? "Removing…" : "Remove MFA"}
          </button>
          {error && <p style={{ color: "#8b1a1a", fontSize: "0.82rem", marginTop: "0.75rem" }}>⚠ {error}</p>}
        </>
      );
    }

    if (step === "enrol") return (
      <>
        <p style={{ fontSize: "0.88rem", color: "#444", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          Multi-factor authentication (MFA) adds a second layer of security to your account. After entering your password, you will also need to enter a 6-digit code from an authenticator app on your phone.
        </p>
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "4px", padding: "0.9rem 1rem", marginBottom: "1.5rem", fontSize: "0.82rem", color: "#78350f" }}>
          <strong>Before you start:</strong> Install an authenticator app on your phone —
          Google Authenticator, Microsoft Authenticator, or Authy are recommended.
        </div>
        <button className="btn-primary" onClick={startEnrolment} disabled={loading}>
          {loading ? "Starting setup…" : "🔐 Set Up MFA Now"}
        </button>
        {error && <p style={{ color: "#8b1a1a", fontSize: "0.82rem", marginTop: "0.75rem" }}>⚠ {error}</p>}
      </>
    );

    if (step === "verify") return (
      <>
        <p style={{ fontSize: "0.82rem", color: "#555", marginBottom: "1.2rem", lineHeight: 1.6 }}>
          <strong>Step 1:</strong> Open your authenticator app and scan the QR code below, or enter the manual key.
        </p>

        {/* QR Code */}
        <div style={{ textAlign: "center", marginBottom: "1.2rem" }}>
          <img src={qrUrl} alt="MFA QR Code" style={{ border: "6px solid #fff", boxShadow: "0 0 0 1px rgba(30,107,60,0.2)", borderRadius: "4px" }} />
        </div>

        {/* Manual key */}
        <details style={{ marginBottom: "1.2rem" }}>
          <summary style={{ fontSize: "0.78rem", color: "#1e6b3c", cursor: "pointer", fontFamily: "'Cinzel',serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Can&#x2019;t scan? Enter key manually
          </summary>
          <div style={{ marginTop: "0.75rem", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: "3px", padding: "0.6rem 0.9rem", fontFamily: "monospace", fontSize: "0.9rem", letterSpacing: "0.15em", color: "#1a1a1a", wordBreak: "break-all" }}>
            {manualKey}
          </div>
          <p style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.4rem" }}>
            Enter this key into your authenticator app when prompted for a setup key.
          </p>
        </details>

        {/* Code entry */}
        <p style={{ fontSize: "0.82rem", color: "#555", marginBottom: "0.6rem" }}>
          <strong>Step 2:</strong> Enter the 6-digit code shown in your app to confirm setup.
        </p>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          style={{ width: "100%", padding: "0.75rem 1rem", fontSize: "1.4rem", letterSpacing: "0.4em", textAlign: "center", border: "1px solid rgba(30,107,60,0.3)", borderRadius: "3px", marginBottom: "1rem", fontFamily: "monospace" }}
          onKeyDown={e => e.key === "Enter" && verifyAndEnrol()}
          autoFocus
        />
        {error && <p style={{ color: "#8b1a1a", fontSize: "0.82rem", marginBottom: "0.75rem" }}>⚠ {error}</p>}
        <button className="btn-primary" onClick={verifyAndEnrol} disabled={loading || code.length !== 6} style={{ width: "100%" }}>
          {loading ? "Verifying…" : "✓ Confirm & Enable MFA"}
        </button>
        <button onClick={() => { setStep("enrol"); setCode(""); setError(""); }}
          style={{ width: "100%", marginTop: "0.5rem", background: "transparent", border: "1px solid #e5e7eb", color: "#888", padding: "0.5rem", borderRadius: "3px", cursor: "pointer", fontSize: "0.82rem" }}>
          Cancel
        </button>
      </>
    );

    if (step === "done") return (
      <>
        <div style={{ textAlign: "center", padding: "1rem 0 1.5rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎉</div>
          <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: "1.1rem", color: "#1a5c35", marginBottom: "0.5rem" }}>MFA Enabled Successfully</h2>
          <p style={{ fontSize: "0.85rem", color: "#555", lineHeight: 1.6 }}>
            Your account is now protected with multi-factor authentication. The next time you sign in, you will be asked for your 6-digit authenticator code after entering your password.
          </p>
        </div>
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "4px", padding: "0.9rem 1rem", fontSize: "0.82rem", color: "#78350f" }}>
          <strong>Important:</strong> Do not delete the account from your authenticator app. If you lose access to your authenticator, contact your System Administrator to reset your account.
        </div>
      </>
    );
  };

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />
      <div className="sidebar-content">
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Cinzel',serif", fontSize: "0.7rem", letterSpacing: "0.25em", color: "#1e6b3c", textTransform: "uppercase", marginBottom: "0.4rem" }}>Account Security</p>
          <h1 style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: "1.8rem", color: "#1a1a1a" }}>Multi-Factor Authentication</h1>
        </div>
        <div style={sCard}>
          <p style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.15em", color: "#1e6b3c", textTransform: "uppercase", marginBottom: "1.2rem" }}>
            ◈ MFA Setup — {user?.email}
          </p>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
