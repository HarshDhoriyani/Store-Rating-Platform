import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = "/api";
const ROLE_LABELS = { admin: "System Administrator", user: "Normal User", store_owner: "Store Owner" };

async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

function Login({ onLogin, onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand"><span className="brand-mark">S</span><b>StoreRate</b></div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-heading"><p>WELCOME BACK</p><h1>Sign in to your account</h1></div>
        {error && <div className="alert error">{error}</div>}
        <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" /></label>
        <button className="primary" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        <p className="auth-switch">New here? <button type="button" onClick={onSignup}>Create an account</button></p>
      </form>
    </div>
  );
}

function Signup({ onLogin, onBack }) {
  const [form, setForm] = useState({ name: "", email: "", address: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/auth/signup", { method: "POST", body: JSON.stringify(form) });
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand"><span className="brand-mark">S</span><b>StoreRate</b></div>
      <form className="auth-card signup-card" onSubmit={submit}>
        <div className="auth-heading"><p>CREATE ACCOUNT</p><h1>Join the community</h1></div>
        {error && <div className="alert error">{error}</div>}
        <label>Full name<input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="At least 20 characters" /></label>
        <label>Email address<input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></label>
        <label>Address<textarea value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={400} placeholder="Maximum 400 characters" /></label>
        <label>Password<input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required placeholder="8-16 chars, uppercase & special" /></label>
        <button className="primary" disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
        <p className="auth-switch">Already have an account? <button type="button" onClick={onBack}>Sign in</button></p>
      </form>
    </div>
  );
}

function PasswordModal({ onClose }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await api("/auth/password", { method: "PUT", body: JSON.stringify({ password }) });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>×</button>
        <h2>Update password</h2>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        <label>New password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="primary">Update password</button>
      </form>
    </div>
  );
}

function Layout({ user, onLogout, children }) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <button type="button" className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">×</button>
        <div className="brand"><span className="brand-mark">S</span><b>StoreRate</b></div>
        <div className="nav-label">WORKSPACE</div>
        <div className="active-nav">{user.role === "admin" ? "▦  Dashboard" : user.role === "store_owner" ? "◉  Store Dashboard" : "⌂  Stores"}</div>
        <div className="sidebar-user">
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div><b>{user.name}</b><span>{ROLE_LABELS[user.role]}</span></div>
        </div>
        <div className="sidebar-actions">
          <button onClick={() => setPasswordOpen(true)}>↻ Update password</button>
          <button onClick={onLogout}>⇥ Log out</button>
        </div>
      </aside>
      {mobileOpen && <button type="button" className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main className="content">
        <div className="mobile-header">
          <button type="button" className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button>
          <div className="brand mobile-brand"><span className="brand-mark">S</span><b>StoreRate</b></div>
        </div>
        {children}
      </main>
      {passwordOpen && <PasswordModal onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}

function DataTable({ columns, rows, onRowClick }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.id || index} onClick={() => onRowClick?.(row)} className={onRowClick ? "clickable-row" : ""}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : (row[column.key] ?? "—")}</td>)}
            </tr>
          )) : <tr><td className="empty" colSpan={columns.length}>No records found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AdminDashboard() {
  const [counts, setCounts] = useState({});
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState("stores");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState({ field: "name", direction: "asc" });
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [storeOwners, setStoreOwners] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [storeForm, setStoreForm] = useState({ name: "", email: "", address: "", ownerId: "" });
  const [userForm, setUserForm] = useState({ name: "", email: "", address: "", password: "", role: "user" });

  async function load() {
    const direction = sort.direction;
    const [countData, storeData, userData, ownerData] = await Promise.all([
      api("/admin/dashboard"),
      api(`/admin/stores?search=${encodeURIComponent(search)}&sort=${sort.field}&direction=${direction}`),
      api(`/admin/users?search=${encodeURIComponent(search)}&role=${role}&sort=${sort.field}&direction=${direction}`),
      api("/admin/store-owners"),
    ]);
    setCounts(countData); setStores(storeData); setUsers(userData); setStoreOwners(ownerData);
  }

  useEffect(() => { load().catch(() => setMessage("Could not load dashboard data.")); }, [search, role, sort]);

  function toggleSort(field) {
    setSort((current) => ({ field, direction: current.field === field && current.direction === "asc" ? "desc" : "asc" }));
  }

  async function createStore(event) {
    event.preventDefault();
    try {
      setMessage((await api("/admin/stores", { method: "POST", body: JSON.stringify(storeForm) })).message);
      setShowStoreForm(false); setStoreForm({ name: "", email: "", address: "", ownerId: "" }); load();
    } catch (err) { setMessage(err.message); }
  }

  async function createUserSubmit(event) {
    event.preventDefault();
    try {
      setMessage((await api("/admin/users", { method: "POST", body: JSON.stringify(userForm) })).message);
      setShowUserForm(false); setUserForm({ name: "", email: "", address: "", password: "", role: "user" }); load();
    } catch (err) { setMessage(err.message); }
  }

  const storeColumns = [
    { key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "address", label: "Address" },
    { key: "rating", label: "Rating", render: (row) => <RatingValue value={row.rating} /> },
  ];
  const userColumns = [
    { key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "address", label: "Address" },
    { key: "role", label: "Role", render: (row) => <span className={`role-badge ${row.role}`}>{ROLE_LABELS[row.role]}</span> },
    { key: "rating", label: "Store rating", render: (row) => row.rating === null ? "—" : <RatingValue value={row.rating} /> },
  ];

  return (
    <div>
      <header className="page-header"><div><p>OVERVIEW</p><h1>Admin Dashboard</h1></div></header>
      {message && <div className="alert success">{message}</div>}
      <div className="stats">
        <StatCard icon="◉" label="Total users" value={counts.totalUsers ?? 0} />
        <StatCard icon="▣" label="Registered stores" value={counts.totalStores ?? 0} />
        <StatCard icon="★" label="Submitted ratings" value={counts.totalRatings ?? 0} />
      </div>
      <section className="panel">
        <div className="panel-toolbar">
          <div className="tabs">
            <button className={tab === "stores" ? "selected" : ""} onClick={() => setTab("stores")}>Stores</button>
            <button className={tab === "users" ? "selected" : ""} onClick={() => setTab("users")}>Users</button>
          </div>
          <div className="toolbar-actions">
            {tab === "users" && <select value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option><option value="admin">Admin</option><option value="user">User</option><option value="store_owner">Store owner</option></select>}
            <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${tab}...`} />
            {tab === "stores" ? <button className="primary compact" onClick={() => setShowStoreForm(true)}>+ Add store</button> : <button className="primary compact" onClick={() => setShowUserForm(true)}>+ Add user</button>}
          </div>
        </div>
        <div className="sort-row">{["name", "email", "address", ...(tab === "users" ? ["role"] : ["rating"])].map((field) => (
          <button key={field} onClick={() => toggleSort(field)}>Sort: {field}{sort.field === field ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}</button>
        ))}</div>
        {tab === "stores" ? <DataTable columns={storeColumns} rows={stores} /> : (
          <DataTable
            columns={userColumns}
            rows={users}
            onRowClick={(row) => api(`/admin/users/${row.id}`).then(setSelectedUser).catch((err) => setMessage(err.message))}
          />
        )}
      </section>

      {showStoreForm && (
        <div className="modal-backdrop" onMouseDown={() => setShowStoreForm(false)}>
          <form className="modal" onSubmit={createStore} onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowStoreForm(false)}>×</button><h2>Add store</h2>
            <label>Store name<input value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} required /></label>
            <label>Email<input type="email" value={storeForm.email} onChange={(e) => setStoreForm({ ...storeForm, email: e.target.value })} required /></label>
            <label>Address<textarea maxLength={400} value={storeForm.address} onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })} /></label>
            <label>Store owner<select value={storeForm.ownerId} onChange={(e) => setStoreForm({ ...storeForm, ownerId: e.target.value })}><option value="">No owner assigned</option>{storeOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
            <button className="primary">Create store</button>
          </form>
        </div>
      )}
      {showUserForm && (
        <div className="modal-backdrop" onMouseDown={() => setShowUserForm(false)}>
          <form className="modal" onSubmit={createUserSubmit} onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowUserForm(false)}>×</button><h2>Add user</h2>
            <label>Name<input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required /></label>
            <label>Email<input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required /></label>
            <label>Address<textarea maxLength={400} value={userForm.address} onChange={(e) => setUserForm({ ...userForm, address: e.target.value })} /></label>
            <label>Password<input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required /></label>
            <label>Role<select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}><option value="user">Normal user</option><option value="admin">Admin</option><option value="store_owner">Store owner</option></select></label>
            <button className="primary">Create user</button>
          </form>
        </div>
      )}
      {selectedUser && (
        <div className="modal-backdrop" onMouseDown={() => setSelectedUser(null)}>
          <div className="modal user-details" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setSelectedUser(null)}>×</button>
            <h2>User details</h2>
            <dl>
              <dt>Name</dt><dd>{selectedUser.name}</dd>
              <dt>Email</dt><dd>{selectedUser.email}</dd>
              <dt>Address</dt><dd>{selectedUser.address || "Not provided"}</dd>
              <dt>Role</dt><dd>{ROLE_LABELS[selectedUser.role]}</dd>
              {selectedUser.role === "store_owner" && <><dt>Store rating</dt><dd>{selectedUser.rating ?? "0.0"}</dd></>}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><p>{label}</p><h2>{value}</h2></div></div>;
}
function RatingValue({ value }) {
  return <span className="rating"><b>★</b> {Number(value).toFixed(1)}</span>;
}

function UserStores() {
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setStores(await api(`/stores?search=${encodeURIComponent(search)}`));
  }
  useEffect(() => { load().catch((err) => setMessage(err.message)); }, [search]);

  async function rate(storeId, rating) {
    try {
      setMessage((await api(`/stores/${storeId}/rating`, { method: "POST", body: JSON.stringify({ rating }) })).message);
      load();
    } catch (err) { setMessage(err.message); }
  }

  return (
    <div>
      <header className="page-header"><div><p>DISCOVER</p><h1>Registered Stores</h1></div></header>
      {message && <div className="alert success">{message}</div>}
      <div className="store-toolbar"><input className="search wide" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by store name or address..." /></div>
      <div className="store-grid">
        {stores.map((store) => (
          <article className="store-card" key={store.id}>
            <div className="store-avatar">{store.name.slice(0, 1)}</div>
            <div className="store-info"><h2>{store.name}</h2><p>{store.address || "Address not provided"}</p></div>
            <div className="store-ratings">
              <div><span>Overall rating</span><RatingValue value={store.overallRating} /></div>
              <div><span>Your rating</span><b>{store.submittedRating ? `${store.submittedRating} / 5` : "Not rated"}</b></div>
            </div>
            <div className="star-picker" aria-label={`Rate ${store.name}`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" className={store.submittedRating >= star ? "filled" : ""} onClick={() => rate(store.id, star)} title={`${star} star${star > 1 ? "s" : ""}`}>★</button>
              ))}
              <span>{store.submittedRating ? "Modify rating" : "Submit rating"}</span>
            </div>
          </article>
        ))}
        {!stores.length && <div className="panel empty-panel">No stores match your search.</div>}
      </div>
    </div>
  );
}

function OwnerDashboard() {
  const [data, setData] = useState({ store: null, raters: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    api("/owner/dashboard").then(setData).catch((err) => setError(err.message));
  }, []);

  const storeColumns = [
    { key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "address", label: "Address" },
    { key: "rating", label: "Rating", render: (row) => <RatingValue value={row.rating} /> },
  ];

  return (
    <div>
      <header className="page-header"><div><p>STORE INSIGHTS</p><h1>{data.store?.name || "Store Dashboard"}</h1></div></header>
      {error && <div className="alert error">{error}</div>}
      <div className="stats">
        <StatCard icon="★" label="Average rating" value={data.store?.averageRating ? Number(data.store.averageRating).toFixed(1) : "0.0"} />
        <StatCard icon="◉" label="Customers rated" value={data.raters.length} />
      </div>
      <section className="panel">
        <div className="panel-heading"><h2>Customer Ratings</h2><span>{data.raters.length} submissions</span></div>
        <DataTable columns={storeColumns} rows={data.raters} />
      </section>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("session")); } catch { return null; }
  });
  const [authView, setAuthView] = useState("login");

  function login(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("session", JSON.stringify(data.user));
    setSession(data.user);
  }
  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("session");
    setSession(null);
  }

  if (!session) {
    return authView === "signup"
      ? <Signup onLogin={login} onBack={() => setAuthView("login")} />
      : <Login onLogin={login} onSignup={() => setAuthView("signup")} />;
  }

  return (
    <Layout user={session} onLogout={logout}>
      {session.role === "admin" ? <AdminDashboard /> : session.role === "store_owner" ? <OwnerDashboard /> : <UserStores />}
    </Layout>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>,
);
