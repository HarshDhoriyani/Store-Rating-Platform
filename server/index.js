import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getConnection } from "./config.js";
import { isValidAddress, isValidEmail, isValidName, isValidPassword } from "./validation.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
app.disable("x-powered-by");
app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (isProduction && allowedOrigins.length === 0) {
  throw new Error("FRONTEND_ORIGIN must be configured in production.");
}
app.use(cors((req, callback) => {
  const origin = req.header("Origin");
  if (!origin || !isProduction || allowedOrigins.includes(origin)) {
    return callback(null, { origin: true });
  }
  return callback(null, { origin: false });
}));
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)
      && (req.body === null || typeof req.body !== "object" || Array.isArray(req.body))) {
    return res.status(400).json({ message: "Request body must be a JSON object." });
  }
  return next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Please try again later." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET is required in production.");
}
const signingSecret = JWT_SECRET || "local-development-only-secret";

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, signingSecret, { expiresIn: "8h" });
}

function auth(requiredRoles) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Authentication required." });
    try {
      req.user = jwt.verify(header.slice(7), signingSecret);
      if (requiredRoles && !requiredRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "You do not have permission." });
      }
      next();
    } catch {
      res.status(401).json({ message: "Invalid or expired session." });
    }
  };
}

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, address = "", password } = req.body;
  if (!isValidName(name)) return res.status(400).json({ message: "Name must be between 20 and 60 characters." });
  if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
  if (!isValidAddress(address)) return res.status(400).json({ message: "Address must be text no longer than 400 characters." });
  if (!isValidPassword(password)) return res.status(400).json({ message: "Password must be 8-16 characters with one uppercase letter and one special character." });
  const connection = await getConnection();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await connection.query(
      "INSERT INTO users (name, email, password_hash, address, role) VALUES (?, ?, ?, ?, 'user')",
      [name.trim(), email.trim().toLowerCase(), passwordHash, address.trim()],
    );
    const user = { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), role: "user" };
    res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email is already registered." });
    res.status(500).json({ message: "Could not create account." });
  } finally {
    connection.release();
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const connection = await getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT id, name, email, password_hash, role FROM users WHERE email = ?",
      [String(email).trim().toLowerCase()],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ token: signToken(publicUser), user: publicUser });
  } catch {
    res.status(500).json({ message: "Could not log in." });
  } finally {
    connection.release();
  }
});

app.put("/api/auth/password", auth(["admin", "user", "store_owner"]), async (req, res) => {
  const { password } = req.body;
  if (!isValidPassword(password)) return res.status(400).json({ message: "Password must be 8-16 characters with one uppercase letter and one special character." });
  const connection = await getConnection();
  try {
    await connection.query("UPDATE users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(password, 10), req.user.id]);
    res.json({ message: "Password updated successfully." });
  } finally {
    connection.release();
  }
});

app.get("/api/admin/dashboard", auth(["admin"]), async (_req, res) => {
  const connection = await getConnection();
  try {
    const [[counts]] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS totalUsers,
        (SELECT COUNT(*) FROM stores) AS totalStores,
        (SELECT COUNT(*) FROM ratings) AS totalRatings
    `);
    res.json(counts);
  } finally {
    connection.release();
  }
});

app.get("/api/admin/stores", auth(["admin"]), async (req, res) => {
  const { search = "", sort = "name", direction = "asc" } = req.query;
  const allowedSort = ["name", "email", "address", "rating"];
  const column = allowedSort.includes(sort) ? sort : "name";
  const dir = String(direction).toLowerCase() === "desc" ? "DESC" : "ASC";
  const connection = await getConnection();
  try {
    const [rows] = await connection.query(`
      SELECT s.id, s.name, s.email, s.address,
        COALESCE(ROUND(AVG(r.rating), 1), 0) AS rating
      FROM stores s LEFT JOIN ratings r ON r.store_id = s.id
      WHERE s.name LIKE ? OR s.email LIKE ? OR s.address LIKE ?
      GROUP BY s.id, s.name, s.email, s.address
      ORDER BY ${column === "rating" ? "rating" : `s.${column}`} ${dir}
    `, [`%${search}%`, `%${search}%`, `%${search}%`]);
    res.json(rows);
  } finally {
    connection.release();
  }
});

app.post("/api/admin/stores", auth(["admin"]), async (req, res) => {
  const { name, email, address = "", ownerId = null } = req.body;
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60) {
    return res.status(400).json({ message: "Store name must be between 2 and 60 characters." });
  }
  if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid store email." });
  if (!isValidAddress(address)) return res.status(400).json({ message: "Address must be text no longer than 400 characters." });
  const connection = await getConnection();
  try {
    if (ownerId) {
      const [[owner]] = await connection.query(
        "SELECT id FROM users WHERE id = ? AND role = 'store_owner'",
        [ownerId],
      );
      if (!owner) return res.status(400).json({ message: "Owner must be an existing store owner." });
    }
    await connection.query("INSERT INTO stores (name, email, address, owner_id) VALUES (?, ?, ?, ?)", [name.trim(), email.trim().toLowerCase(), address.trim(), ownerId || null]);
    res.status(201).json({ message: "Store created successfully." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Store email already exists." });
    res.status(500).json({ message: "Could not create store." });
  } finally {
    connection.release();
  }
});

app.get("/api/admin/users", auth(["admin"]), async (req, res) => {
  const { search = "", role = "", sort = "name", direction = "asc" } = req.query;
  const allowedSort = ["name", "email", "address", "role"];
  const column = allowedSort.includes(sort) ? sort : "name";
  const dir = String(direction).toLowerCase() === "desc" ? "DESC" : "ASC";
  const connection = await getConnection();
  try {
    let query = `SELECT u.id, u.name, u.email, u.address, u.role,
      CASE WHEN u.role = 'store_owner' THEN COALESCE(ROUND(AVG(r.rating), 1), 0) ELSE NULL END AS rating
      FROM users u LEFT JOIN stores s ON s.owner_id = u.id LEFT JOIN ratings r ON r.store_id = s.id
      WHERE (u.name LIKE ? OR u.email LIKE ? OR u.address LIKE ?)
    `;
    const params = [`%${search}%`, `%${search}%`, `%${search}%`];
    if (["admin", "user", "store_owner"].includes(role)) {
      query += " AND u.role = ?";
      params.push(role);
    }
    query += ` GROUP BY u.id, u.name, u.email, u.address, u.role ORDER BY u.${column} ${dir}`;
    const [rows] = await connection.query(query, params);
    res.json(rows);
  } finally {
    connection.release();
  }
});

app.post("/api/admin/users", auth(["admin"]), async (req, res) => {
  const { name, email, address = "", password, role = "user" } = req.body;
  if (!isValidName(name)) return res.status(400).json({ message: "Name must be between 20 and 60 characters." });
  if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
  if (!isValidAddress(address)) return res.status(400).json({ message: "Address must be text no longer than 400 characters." });
  if (!isValidPassword(password)) return res.status(400).json({ message: "Password must be 8-16 characters with one uppercase letter and one special character." });
  if (!["admin", "user", "store_owner"].includes(role)) return res.status(400).json({ message: "Invalid role." });
  const connection = await getConnection();
  try {
    await connection.query(
      "INSERT INTO users (name, email, password_hash, address, role) VALUES (?, ?, ?, ?, ?)",
      [name.trim(), email.trim().toLowerCase(), await bcrypt.hash(password, 10), address.trim(), role],
    );
    res.status(201).json({ message: "User created successfully." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email is already registered." });
    res.status(500).json({ message: "Could not create user." });
  } finally {
    connection.release();
  }
});

app.get("/api/admin/users/:id", auth(["admin"]), async (req, res) => {
  const connection = await getConnection();
  try {
    const [[user]] = await connection.query(
      `SELECT u.id, u.name, u.email, u.address, u.role,
        CASE WHEN u.role = 'store_owner' THEN COALESCE(ROUND(AVG(r.rating), 1), 0) ELSE NULL END AS rating
       FROM users u
       LEFT JOIN stores s ON s.owner_id = u.id
       LEFT JOIN ratings r ON r.store_id = s.id
       WHERE u.id = ?
       GROUP BY u.id, u.name, u.email, u.address, u.role`,
      [req.params.id],
    );
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json(user);
  } finally {
    connection.release();
  }
});

app.get("/api/admin/store-owners", auth(["admin"]), async (_req, res) => {
  const connection = await getConnection();
  try {
    const [owners] = await connection.query(
      "SELECT id, name, email FROM users WHERE role = 'store_owner' ORDER BY name ASC",
    );
    res.json(owners);
  } finally {
    connection.release();
  }
});

app.get("/api/stores", auth(["user", "admin"]), async (req, res) => {
  const { search = "" } = req.query;
  const connection = await getConnection();
  try {
    const [rows] = await connection.query(`
      SELECT s.id, s.name, s.address,
        COALESCE(ROUND(AVG(r.rating), 1), 0) AS overallRating,
        MAX(CASE WHEN r.user_id = ? THEN r.rating END) AS submittedRating
      FROM stores s LEFT JOIN ratings r ON r.store_id = s.id
      WHERE s.name LIKE ? OR s.address LIKE ?
      GROUP BY s.id, s.name, s.address
      ORDER BY s.name ASC
    `, [req.user.id, `%${search}%`, `%${search}%`]);
    res.json(rows);
  } finally {
    connection.release();
  }
});

app.post("/api/stores/:id/rating", auth(["user"]), async (req, res) => {
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be a whole number between 1 and 5." });
  }
  const connection = await getConnection();
  try {
    const [[store]] = await connection.query("SELECT id FROM stores WHERE id = ?", [req.params.id]);
    if (!store) return res.status(404).json({ message: "Store not found." });
    await connection.query(
      `INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
      [req.user.id, req.params.id, rating],
    );
    res.json({ message: "Rating saved successfully." });
  } finally {
    connection.release();
  }
});

app.get("/api/owner/dashboard", auth(["store_owner"]), async (req, res) => {
  const connection = await getConnection();
  try {
    const [[store]] = await connection.query(
      "SELECT s.id, s.name, COALESCE(ROUND(AVG(r.rating), 1), 0) AS averageRating FROM stores s LEFT JOIN ratings r ON r.store_id = s.id WHERE s.owner_id = ? GROUP BY s.id, s.name",
      [req.user.id],
    );
    if (!store) return res.json({ store: null, raters: [] });
    const [raters] = await connection.query(
      `SELECT u.name, u.email, u.address, r.rating
       FROM ratings r JOIN users u ON u.id = r.user_id
       WHERE r.store_id = ? ORDER BY r.updated_at DESC`,
      [store.id],
    );
    res.json({ store, raters });
  } finally {
    connection.release();
  }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api", (_req, res) => res.status(404).json({ message: "API endpoint not found." }));

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
if (isProduction) {
  app.use(express.static(resolve(projectRoot, "dist"), { index: false, maxAge: "1d" }));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/")) {
      return res.sendFile(resolve(projectRoot, "dist", "index.html"));
    }
    return next();
  });
}

app.use((error, _req, res, _next) => {
  console.error("Unhandled application error:", error);
  res.status(500).json({ message: "An unexpected server error occurred." });
});

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => console.log(`Application server listening on ${host}:${port}`));
