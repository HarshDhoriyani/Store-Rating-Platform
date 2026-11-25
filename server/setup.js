import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { dbConfig } from "./config.js";
import { isValidEmail, isValidName, isValidPassword } from "./validation.js";

const connection = await mysql.createConnection({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  multipleStatements: true,
});

await connection.query("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", [dbConfig.database]);
await connection.changeUser({ database: dbConfig.database });
await connection.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    address VARCHAR(400) NULL,
    role ENUM('admin','user','store_owner') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS stores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    address VARCHAR(400) NULL,
    owner_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_store_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    store_id INT NOT NULL,
    rating TINYINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rating_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_rating_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_store (user_id, store_id),
    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5)
  );
`);

const adminName = process.env.ADMIN_NAME?.trim();
const adminEmail = process.env.ADMIN_EMAIL?.trim();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminConfig = [adminName, adminEmail, adminPassword];
if (adminConfig.some(Boolean) && !adminConfig.every(Boolean)) {
  throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD together to create the initial administrator.");
}
if (adminName && adminEmail && adminPassword) {
  if (!isValidName(adminName) || !isValidEmail(adminEmail) || !isValidPassword(adminPassword)) {
    throw new Error("Initial administrator details do not meet the application validation requirements.");
  }
  const [existing] = await connection.query("SELECT id FROM users WHERE email = ?", [adminEmail.toLowerCase()]);
  if (existing.length === 0) {
    await connection.query(
      "INSERT INTO users (name, email, password_hash, address, role) VALUES (?, ?, ?, ?, 'admin')",
      [adminName, adminEmail.toLowerCase(), await bcrypt.hash(adminPassword, 10), ""],
    );
  } else {
    const [[existingUser]] = await connection.query("SELECT role FROM users WHERE email = ?", [adminEmail.toLowerCase()]);
    if (existingUser.role !== "admin") {
      throw new Error("ADMIN_EMAIL is already used by a non-administrator account.");
    }
  }
}

console.log("Database setup complete.");
await connection.end();
