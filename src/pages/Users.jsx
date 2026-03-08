import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { cacheGet, cacheSet, cacheClear } from "../utils/cache";
import { createUserWithEmailAndPassword, updatePassword, sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth, db, secondaryAuth } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";
import { Navigate } from "react-router-dom";

const ROLES = ["admin", "standard_admin", "data_entry", "view"];
const ROLE_LABELS = { admin:"Admin", standard_admin:"Standard Admin", data_entry:"Data Entry", view:"View Only" };
const ROLE_COLORS = { admin:"#991b1b", standard_admin:"#1e40af", data_entry:"#155c31", view:"#374151" };
const ROLE_DESC = {
  admin: [
    "Full access to all features",
    "Add, edit & delete records",
    "Import records from Excel",
    "Export records to Excel",
    "Print & view certificates",
    "View all notifications & confirm registrations",
    "Generate all PDF reports",
    "Manage users & roles",
    "View full audit log",
    "Access data management",
  ],
  standard_admin: [
    "Add, edit & delete records",
    "Import records from Excel",
    "Export records to Excel",
    "Print & view certificates",
    "View all notifications & confirm registrations",
    "Generate all PDF reports",
    "Cannot manage users, audit log or data management",
  ],
  data_entry: [
    "Add & edit records",
    "Import records from Excel",
    "View certificates (cannot print)",
    "View notifications — see & fix duplicate alerts",
    "View reports (cannot print PDFs)",
    "Cannot delete records",
    "Cannot manage users, audit log or data management",
  ],
  view: [
    "View all registry records",
    "View notifications (cannot confirm or edit)",
    "View reports (cannot print PDFs)",
    "Cannot add, edit or delete records",
    "Cannot print certificates",
    "Cannot import or export",
    "Cannot manage users, audit log or data management",
  ],
};

const TEST_USERS = [
  { email: "admin.test@matai.gov.ws",          password: "Admin@1234",        role: "admin",          displayName: "Test Admin",          department: "Registry Administration" },
  { email: "standardadmin.test@matai.gov.ws",  password: "StdAdmin@1234",     role: "standard_admin", displayName: "Test Standard Admin", department: "Registry Division" },
  { email: "dataentry.test@matai.gov.ws",      password: "DataEntry@1234",    role: "data_entry",     displayName: "Test Data Entry",     department: "Registry Division" },
  { email: "view.test@matai.gov.ws",           password: "View@1234",         role: "view",           displayName: "Test View Only",      department: "Public Access" },
];

const fmtDate = (ts) => {
  if (!ts?.toDate) return "—";
  const d = ts.toDate();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
};

export default function Users({ userRole }) {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [mode, setMode]           = useState("list"); // list | add | edit
  const [editUser, setEditUser]   = useState(null);
  const [form, setForm]           = useState({ email:"", password:"", role:"view", displayName:"", phone:"", department:"" });
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(null);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [resetMsg, setResetMsg]           = useState({ id: null, msg: "", ok: false });
  const [seedingUsers, setSeedingUsers] = useState(false);
  const [seedUserMsg, setSeedUserMsg]   = useState("");

  const handleResetPassword = async (email, userId) => {
    setResetMsg({ id: userId, msg: "Sending…", ok: false });
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMsg({ id: userId, msg: `✓ Reset email sent to ${email}`, ok: true });
      await logAudit("PASSWORD_RESET_SENT", { email });
    } catch (err) {
      setResetMsg({ id: userId, msg: `✗ Failed: ${err.message}`, ok: false });
    }
    setTimeout(() => setResetMsg({ id: null, msg: "", ok: false }), 4000);
  };
  const perms       = getPermissions(userRole);
  const currentUser = auth.currentUser;

  if (userRole === null) return null; // still loading — don't redirect yet
  if (!perms.canViewUsers) return <Navigate to="/dashboard" />;

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const resetForm = () => { setForm({ email:"", password:"", role:"view", displayName:"", phone:"", department:"" }); setError(""); setSuccess(""); setEditUser(null); setMode("list"); };

  // ── Create user ──
  const handleCreate = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.email || !form.password) { setError("Email and password required."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setSaving(true);
    try {
      const trimmedEmail = form.email.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(secondaryAuth, trimmedEmail, form.password);
      cacheClear("users"); await setDoc(doc(db, "users", cred.user.uid), {
        email: trimmedEmail, role: form.role,
        displayName: form.displayName || "",
        phone: form.phone || "",
        department: form.department || "",
        createdAt: serverTimestamp()
      });
      await logAudit("CREATE_USER", { email: trimmedEmail, role: form.role });
      await secondaryAuth.signOut();
      setSuccess(`✓ User ${trimmedEmail} created with role: ${ROLE_LABELS[form.role]}`);
      fetchUsers();
      setTimeout(resetForm, 1500);
    } catch (err) {
      setError(err.code === "auth/email-already-in-use"
        ? "This email is already registered."
        : err.message);
    } finally { setSaving(false); }
  };

  // ── Open edit mode ──
  const openEdit = (u) => {
    setEditUser(u);
    setForm({ email: u.email, password: "", role: u.role || "view", displayName: u.displayName || "", phone: u.phone || "", department: u.department || "" });
    setError(""); setSuccess("");
    setMode("edit");
  };

  // ── Save edit (role + profile fields) ──
  const handleEdit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setSaving(true);
    try {
      const updates = {
        displayName: form.displayName || "",
        phone: form.phone || "",
        department: form.department || "",
      };
      const changes = [];
      if (form.role !== editUser.role && editUser.id !== currentUser?.uid) {
        updates.role = form.role;
        changes.push(`Role → ${ROLE_LABELS[form.role]}`);
      }
      if (form.displayName !== (editUser.displayName || "")) changes.push("Name updated");
      if (form.phone !== (editUser.phone || "")) changes.push("Phone updated");
      if (form.department !== (editUser.department || "")) changes.push("Department updated");

      cacheClear("users"); await setDoc(doc(db, "users", editUser.id), updates, { merge: true });
      await logAudit("UPDATE_USER", { email: editUser.email, changes: changes.join(", ") });
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...updates } : u));
      setSuccess(`✓ Profile updated. ${changes.join(", ") || "No changes."}`);
      setTimeout(resetForm, 1500);
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  // ── Delete user ──
  const handleDelete = async (uid, email) => {
    setDeleting(uid);
    try {
      cacheClear("users"); await deleteDoc(doc(db, "users", uid));
      await logAudit("DELETE_USER", { email, deletedBy: currentUser?.email });
      setUsers(prev => prev.filter(u => u.id !== uid));
      setConfirmDelete(null);
      setSuccess(`✓ User ${email} removed.`);
    } catch (err) { setError(err.message); }
    finally { setDeleting(null); }
  };

  // ── Inline role change from table ──
  const handleRoleChange = async (uid, email, newRole) => {
    const oldRole = users.find(u => u.id === uid)?.role;
    try {
      cacheClear("users"); await setDoc(doc(db, "users", uid), { role: newRole }, { merge: true });
      await logAudit("UPDATE_ROLE", { email, oldRole, newRole });
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u));
    } catch (err) { console.error(err); }
  };

  const handleSeedUsers = async () => {
    if (!window.confirm("Create 4 test users (admin, data entry, view & print, view only)? Existing accounts will be skipped.")) return;
    setSeedingUsers(true); setSeedUserMsg("");
    let created = 0, skipped = 0;
    for (const u of TEST_USERS) {
      try {
        setSeedUserMsg(`Creating ${u.displayName}…`);
        const cred = await createUserWithEmailAndPassword(secondaryAuth, u.email, u.password);
        await setDoc(doc(db, "users", cred.user.uid), {
          email: u.email, role: u.role,
          displayName: u.displayName, department: u.department,
          phone: "", createdAt: serverTimestamp()
        });
        await secondaryAuth.signOut();
        created++;
      } catch (err) {
        if (err.code === "auth/email-already-in-use") skipped++;
        else console.error(u.email, err.message);
      }
    }
    cacheClear("users");
    setSeedUserMsg(`✓ Done — ${created} created, ${skipped} already existed.`);
    setSeedingUsers(false);
    fetchUsers();
  };

  const th = { padding:"0.75rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.15em", textTransform:"uppercase", color:"rgba(255,255,255,0.9)", textAlign:"left", whiteSpace:"nowrap" };
  const td = { padding:"0.85rem 1rem", fontSize:"0.9rem", borderBottom:"1px solid #e5e7eb" };

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={currentUser?.email} />
      <div className="sidebar-content">

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2rem" }}>
          <div>
            <p className="page-eyebrow">Administration</p>
            <h1 className="page-title">User Management</h1>
          </div>
          {mode === "list" && (
            <div style={{ display:"flex", gap:"0.75rem", alignItems:"center" }}>
              <button className="btn-primary" onClick={() => { resetForm(); setMode("add"); }}>
                ＋ Add User
              </button>
              <button onClick={handleSeedUsers} disabled={seedingUsers}
                style={{ background:"#4a1d96", color:"white", border:"none", padding:"0.5rem 1rem", borderRadius:"4px", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.08em", cursor:"pointer", opacity: seedingUsers ? 0.6 : 1 }}>
                {seedingUsers ? "Creating…" : "🧪 Create Test Users"}
              </button>
              {seedUserMsg && <span style={{ fontSize:"0.78rem", color:"#4a1d96", fontStyle:"italic" }}>{seedUserMsg}</span>}
            </div>
          )}
          {mode !== "list" && (
            <button className="btn-secondary" onClick={resetForm}>← Back to Users</button>
          )}
        </div>

        {error   && <div className="alert alert-error"   style={{ marginBottom:"1rem" }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom:"1rem" }}>{success}</div>}

        {/* ── ADD FORM ── */}
        {mode === "add" && (
          <div className="card fade-in" style={{ marginBottom:"2rem", maxWidth:"600px" }}>
            <h3 className="section-head">◈ Create New User</h3>
            <form onSubmit={handleCreate} style={{ display:"flex", flexDirection:"column", gap:"1.2rem" }}>
              <div className="form-group">
                <label>Email Address *</label>
                <input type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))}
                  placeholder="user@example.com" required />
              </div>
              <div className="form-group">
                <label>Password * (min 6 characters)</label>
                <input type="password" value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))}
                  placeholder="Minimum 6 characters" required />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
                <div className="form-group" style={{ margin:0 }}>
                  <label>Full Name</label>
                  <input type="text" value={form.displayName} onChange={e => setForm(p=>({...p,displayName:e.target.value}))}
                    placeholder="e.g. Sione Faleolo" />
                </div>
                <div className="form-group" style={{ margin:0 }}>
                  <label>Phone</label>
                  <input type="text" value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))}
                    placeholder="e.g. +685 12345" />
                </div>
              </div>
              <div className="form-group">
                <label>Department / Position</label>
                <input type="text" value={form.department} onChange={e => setForm(p=>({...p,department:e.target.value}))}
                  placeholder="e.g. Registry Division" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {/* Role preview */}
              <div style={{ background:"#f0fdf4", border:"1px solid #a7c9b2", borderRadius:"4px", padding:"0.85rem 1rem" }}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:ROLE_COLORS[form.role], letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"0.4rem" }}>
                  {ROLE_LABELS[form.role]} — Permissions
                </p>
                {ROLE_DESC[form.role].map(p => (
                  <p key={p} style={{ fontSize:"0.82rem", color:"#374151", lineHeight:1.7 }}>✓ {p}</p>
                ))}
              </div>
              <div style={{ display:"flex", gap:"0.75rem" }}>
                <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize:"0.78rem" }}>
                  {saving ? "Creating…" : "Create User"}
                </button>
                <button type="button" className="btn-secondary" onClick={resetForm} style={{ fontSize:"0.78rem" }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* ── EDIT FORM ── */}
        {mode === "edit" && editUser && (
          <div className="card fade-in" style={{ marginBottom:"2rem", maxWidth:"600px" }}>
            <h3 className="section-head">◈ Edit User Profile: {editUser.email}</h3>
            <form onSubmit={handleEdit} style={{ display:"flex", flexDirection:"column", gap:"1.2rem" }}>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={form.email} disabled
                  style={{ opacity:0.6, cursor:"not-allowed" }} />
                <p style={{ fontSize:"0.75rem", color:"#6b7280", fontStyle:"italic" }}>Email cannot be changed here.</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
                <div className="form-group" style={{ margin:0 }}>
                  <label>Full Name</label>
                  <input type="text" value={form.displayName} onChange={e => setForm(p=>({...p,displayName:e.target.value}))}
                    placeholder="e.g. Sione Faleolo" />
                </div>
                <div className="form-group" style={{ margin:0 }}>
                  <label>Phone</label>
                  <input type="text" value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))}
                    placeholder="e.g. +685 12345" />
                </div>
              </div>
              <div className="form-group">
                <label>Department / Position</label>
                <input type="text" value={form.department} onChange={e => setForm(p=>({...p,department:e.target.value}))}
                  placeholder="e.g. Registry Division" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}
                  disabled={editUser.id === currentUser?.uid}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                {editUser.id === currentUser?.uid && (
                  <p style={{ fontSize:"0.75rem", color:"#991b1b", fontStyle:"italic" }}>You cannot change your own role.</p>
                )}
              </div>
              {/* Role preview */}
              <div style={{ background:"#f0fdf4", border:"1px solid #a7c9b2", borderRadius:"4px", padding:"0.85rem 1rem" }}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:ROLE_COLORS[form.role], letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"0.4rem" }}>
                  {ROLE_LABELS[form.role]} — Permissions
                </p>
                {ROLE_DESC[form.role].map(p => (
                  <p key={p} style={{ fontSize:"0.82rem", color:"#374151", lineHeight:1.7 }}>✓ {p}</p>
                ))}
              </div>
              <div style={{ display:"flex", gap:"0.75rem" }}>
                <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize:"0.78rem" }}>
                  {saving ? "Saving…" : "Save Profile"}
                </button>
                <button type="button" className="btn-secondary" onClick={resetForm} style={{ fontSize:"0.78rem" }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* ── DELETE CONFIRM ── */}
        {confirmDelete && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:"4px", padding:"1.25rem 1.5rem", marginBottom:"1.5rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.78rem", color:"#991b1b", marginBottom:"0.25rem" }}>Confirm Delete</p>
              <p style={{ fontSize:"0.9rem", color:"#374151" }}>Remove user <strong>{confirmDelete.email}</strong>? This cannot be undone.</p>
            </div>
            <div style={{ display:"flex", gap:"0.5rem" }}>
              <button onClick={() => handleDelete(confirmDelete.id, confirmDelete.email)}
                disabled={deleting === confirmDelete.id}
                style={{ background:"#991b1b", color:"#fff", border:"none", padding:"0.55rem 1.2rem", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"4px", cursor:"pointer" }}>
                {deleting === confirmDelete.id ? "Deleting…" : "Delete"}
              </button>
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)} style={{ fontSize:"0.72rem" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── USERS TABLE ── */}
        {mode === "list" && (
          <>
            {loading ? (
              <div style={{ textAlign:"center", padding:"4rem", color:"#6b7280", fontStyle:"italic" }}>Loading users…</div>
            ) : (
              <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:"6px", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", marginBottom:"2rem" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#155c31" }}>
                      <th style={th}>Name / Email</th>
                      <th style={th}>Department</th>
                      <th style={th}>Role</th>
                      <th style={th}>Created</th>
                      <th style={th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan={5} style={{ ...td, textAlign:"center", color:"#9ca3af", fontStyle:"italic" }}>No users found.</td></tr>
                    ) : users.map(u => (
                      <tr key={u.id} style={{ background: u.id === currentUser?.uid ? "#f0fdf4" : "#fff" }}>
                        <td style={td}>
                          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                            <div>
                              {u.displayName && <p style={{ fontSize:"0.88rem", color:"#111827", fontWeight:600 }}>{u.displayName}</p>}
                              <p style={{ fontSize: u.displayName ? "0.78rem" : "0.9rem", color: u.displayName ? "#6b7280" : "#111827" }}>{u.email}</p>
                            </div>
                            {u.id === currentUser?.uid && (
                              <span style={{ background:"#dcfce7", color:"#155c31", fontSize:"0.6rem", fontFamily:"'Cinzel',serif", padding:"1px 6px", borderRadius:"8px", letterSpacing:"0.06em" }}>YOU</span>
                            )}
                          </div>
                        </td>
                        <td style={{ ...td, color:"#6b7280", fontSize:"0.83rem" }}>{u.department || "—"}</td>
                        <td style={td}>
                          <select
                            value={u.role || "view"}
                            onChange={e => handleRoleChange(u.id, u.email, e.target.value)}
                            disabled={u.id === currentUser?.uid}
                            style={{ background:"#fff", border:`1.5px solid ${ROLE_COLORS[u.role]||"#d1d5db"}`, color: ROLE_COLORS[u.role]||"#374151", padding:"4px 10px", fontSize:"0.78rem", fontFamily:"'Cinzel',serif", borderRadius:"4px", fontWeight:"600", cursor: u.id === currentUser?.uid ? "not-allowed" : "pointer" }}>
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </select>
                        </td>
                        <td style={{ ...td, color:"#6b7280", fontSize:"0.83rem" }}>{fmtDate(u.createdAt)}</td>
                        <td style={td}>
                          <div style={{ display:"flex", gap:"0.4rem", alignItems:"center", flexWrap:"wrap" }}>
                            <button className="btn-ghost" onClick={() => openEdit(u)} title="Edit user"
                              style={{ fontSize:"0.82rem" }}>✎ Edit</button>
                            <button className="btn-ghost" onClick={() => handleResetPassword(u.email, u.id)}
                              title="Send password reset email"
                              style={{ fontSize:"0.82rem", color:"#1e40af", borderColor:"rgba(30,64,175,0.3)" }}>
                              🔑 Reset PW
                            </button>
                            {u.id !== currentUser?.uid && (
                              <button className="btn-ghost" onClick={() => setConfirmDelete(u)}
                                style={{ color:"#991b1b", borderColor:"rgba(153,27,27,0.3)", fontSize:"0.82rem" }}
                                title="Delete user">✕ Delete</button>
                            )}
                            {resetMsg.id === u.id && (
                              <span style={{ fontSize:"0.72rem", color: resetMsg.ok ? "#155c31" : "#991b1b", fontStyle:"italic" }}>
                                {resetMsg.msg}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Role permissions legend */}
            <div className="card">
              <h3 className="section-head">◈ Role Permissions Reference</h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"1.25rem" }}>
                {ROLES.map(r => (
                  <div key={r} style={{ borderLeft:`3px solid ${ROLE_COLORS[r]}`, paddingLeft:"0.85rem" }}>
                    <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", color:ROLE_COLORS[r], letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.5rem", fontWeight:"700" }}>
                      {ROLE_LABELS[r]}
                    </p>
                    {ROLE_DESC[r].map(p => (
                      <p key={p} style={{ fontSize:"0.8rem", color:"#374151", lineHeight:1.8 }}>• {p}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
