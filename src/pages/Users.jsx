import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";
import { Navigate } from "react-router-dom";

const ROLES = ["admin", "data_entry", "view_print", "view"];
const ROLE_LABELS = { admin:"Admin", data_entry:"Data Entry", view_print:"View & Print", view:"View" };

export default function Users({ userRole }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email:"", password:"", role:"view" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const perms = getPermissions(userRole);
  const currentUser = auth.currentUser;

  if (!perms.canViewUsers) return <Navigate to="/dashboard" />;

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.email || !form.password) { setError("Email and password are required."); return; }
    setSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: form.email, role: form.role, createdAt: serverTimestamp()
      });
      await logAudit("CREATE_USER", { email: form.email, role: form.role });
      setSuccess(`User ${form.email} created successfully.`);
      setForm({ email:"", password:"", role:"view" });
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  const handleRoleChange = async (uid, email, newRole) => {
    try {
      await setDoc(doc(db, "users", uid), { role: newRole }, { merge: true });
      await logAudit("UPDATE_ROLE", { email, newRole });
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u));
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (uid, email) => {
    if (!window.confirm(`Remove user ${email}?`)) return;
    try {
      await deleteDoc(doc(db, "users", uid));
      await logAudit("DELETE_USER", { email });
      setUsers(prev => prev.filter(u => u.id !== uid));
    } catch (err) { console.error(err); }
  };

  const roleColor = { admin:"#f5a0a0", data_entry:"#c9a84c", view_print:"#a0c4f5", view:"rgba(245,237,224,0.4)" };

  return (
    <div style={{ display:"flex", flexDirection:"row", minHeight:"100vh", width:"100vw", maxWidth:"100vw", background:"#0a0a0a", color:"#f5ede0", overflow:"hidden" }}>
      <div className="pattern-bg" style={{ position:"fixed" }} />
      <Sidebar userRole={userRole} userEmail={currentUser?.email} />
      <main style={{ flex:1, padding:"2rem", overflowX:"auto", overflowY:"auto", position:"relative", zIndex:1, minWidth:0 }}>
        <div style={{ marginBottom:"2rem", display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", letterSpacing:"0.25em", color:"rgba(201,168,76,0.6)", textTransform:"uppercase", marginBottom:"0.4rem" }}>Administration</p>
            <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#f5ede0" }}>Users</h1>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ fontSize:"0.78rem" }}>
            {showForm ? "Cancel" : "＋ Add User"}
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom:"1rem" }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom:"1rem" }}>{success}</div>}

        {/* Add user form */}
        {showForm && (
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:"4px", padding:"1.5rem", marginBottom:"2rem" }}>
            <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:"0.78rem", letterSpacing:"0.2em", color:"#c9a84c", textTransform:"uppercase", marginBottom:"1.2rem" }}>◈ New User</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:"1rem", alignItems:"end" }}>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email:e.target.value}))} placeholder="user@example.com" required />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" value={form.password} onChange={e => setForm(p => ({...p, password:e.target.value}))} placeholder="Min 6 characters" required />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role} onChange={e => setForm(p => ({...p, role:e.target.value}))}>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize:"0.78rem" }}>
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users table */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"3rem", color:"rgba(201,168,76,0.5)", fontStyle:"italic" }}>Loading users…</div>
        ) : (
          <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:"4px", overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid rgba(201,168,76,0.2)", background:"rgba(201,168,76,0.05)" }}>
                  {["Email","Role","Created","Actions"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"0.85rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.15em", textTransform:"uppercase", color:"rgba(201,168,76,0.7)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom:"1px solid rgba(201,168,76,0.08)" }}>
                    <td style={{ padding:"0.9rem 1rem" }}>{u.email}</td>
                    <td style={{ padding:"0.9rem 1rem" }}>
                      <select value={u.role || "view"} onChange={e => handleRoleChange(u.id, u.email, e.target.value)}
                        style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(201,168,76,0.3)", color: roleColor[u.role] || "#f5ede0", padding:"3px 8px", fontSize:"0.78rem", fontFamily:"'Cinzel',serif", borderRadius:"2px" }}>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:"0.9rem 1rem", opacity:0.6, fontSize:"0.82rem" }}>
                      {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString("en-NZ") : "—"}
                    </td>
                    <td style={{ padding:"0.9rem 1rem" }}>
                      {u.id !== currentUser?.uid && (
                        <button className="btn-ghost" style={{ color:"#f5a0a0" }} onClick={() => handleDelete(u.id, u.email)} title="Remove user">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Role legend */}
        <div style={{ marginTop:"2rem", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:"4px", padding:"1.2rem 1.5rem" }}>
          <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.15em", color:"rgba(201,168,76,0.6)", textTransform:"uppercase", marginBottom:"0.8rem" }}>◈ Role Permissions</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem" }}>
            {[
              { role:"Admin", color:"#f5a0a0", perms:["Full access","Add / Edit / Delete","Users management","Audit log"] },
              { role:"Data Entry", color:"#c9a84c", perms:["Add records","Edit records","No delete","No print"] },
              { role:"View & Print", color:"#a0c4f5", perms:["View records","Print certificates","No editing","No delete"] },
              { role:"View", color:"rgba(245,237,224,0.4)", perms:["View records only","No print","No editing","No delete"] }
            ].map(({ role, color, perms }) => (
              <div key={role} style={{ borderLeft:`2px solid ${color}`, paddingLeft:"0.75rem" }}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", color, marginBottom:"0.4rem" }}>{role}</p>
                {perms.map(p => <p key={p} style={{ fontSize:"0.75rem", color:"rgba(245,237,224,0.5)", lineHeight:1.6 }}>• {p}</p>)}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
