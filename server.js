// server.js
import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "campus_exchange",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

pool.getConnection()
  .then(conn => { console.log("✅ Connected to DB"); conn.release(); })
  .catch(err => console.error("❌ DB connection failed:", err.message));

// ---------------- User routes ----------------
app.post("/add-user", async (req, res) => {
  const { FullName, Email, PasswordHash, Role } = req.body;
  if (!FullName || !Email || !PasswordHash) return res.status(400).json({ error: "Missing fields" });
  try {
    const [r] = await pool.query(
      "INSERT INTO Users (FullName, Email, PasswordHash, Role) VALUES (?, ?, ?, ?)",
      [FullName.trim(), Email.trim().toLowerCase(), PasswordHash, Role || 'student']
    );
    res.json({ message: "✅ User registered", userId: r.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "Email exists" });
    console.error("/add-user", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  const { Email, Password } = req.body;
  if (!Email || !Password) return res.status(400).json({ error: "Missing credentials" });
  try {
    const [rows] = await pool.query(
      "SELECT UserId, FullName, Email, Role FROM Users WHERE Email = ? AND PasswordHash = ?",
      [Email.trim().toLowerCase(), Password]
    );
    if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });
    res.json({ message: "✅ Login ok", user: rows[0] });
  } catch (err) {
    console.error("/login", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Listings ----------------
app.get("/listings", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT L.ListingId, L.SellerId, L.Title, L.Description, L.Price, L.ItemCondition, L.Status, U.FullName AS SellerName
       FROM Listings L
       LEFT JOIN Users U ON L.SellerId = U.UserId
       WHERE L.Status = 'Available'
       ORDER BY L.CreatedAt DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("/listings", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/add-listing", async (req, res) => {
  const { sellerId, title, description, price, itemCondition } = req.body;
  if (!sellerId || !title || !price) return res.status(400).json({ error: "Missing fields" });
  try {
    const [r] = await pool.query(
      "INSERT INTO Listings (SellerId, Title, Description, Price, ItemCondition) VALUES (?, ?, ?, ?, ?)",
      [sellerId, title, description || null, price, itemCondition || 'Good']
    );
    res.json({ message: "✅ Listing added", listingId: r.insertId });
  } catch (err) {
    console.error("/add-listing", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Purchase (transaction) ----------------
app.post("/purchase", async (req, res) => {
  const { listingId, buyerId, amount, paymentMethod } = req.body;
  if (!listingId || !buyerId || !amount) return res.status(400).json({ error: "Missing fields" });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [lrows] = await conn.query("SELECT SellerId, Status FROM Listings WHERE ListingId = ? FOR UPDATE", [listingId]);
    if (!lrows.length) { await conn.rollback(); return res.status(404).json({ error: "Item not found" }); }
    if (lrows[0].Status === 'Sold') { await conn.rollback(); return res.status(400).json({ error: "Item already sold" }); }

    // Prevent buyer from buying their own listing on server side too (double safety)
    if (lrows[0].SellerId === buyerId) {
      await conn.rollback();
      return res.status(400).json({ error: "You cannot purchase your own listing." });
    }

    await conn.query(
      "INSERT INTO Transactions (ListingId, BuyerId, SellerId, Amount, PaymentMethod) VALUES (?, ?, ?, ?, ?)",
      [listingId, buyerId, lrows[0].SellerId, amount, paymentMethod || 'UPI']
    );

    await conn.commit();
    res.json({ message: "✅ Purchase successful" });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (_) {}
    console.error("/purchase", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// ---------------- Feedback ----------------
app.post("/feedback", async (req, res) => {
  const { fromUserId, toUserId, listingId, rating, comments } = req.body;
  if (!fromUserId || !toUserId || !rating) return res.status(400).json({ error: "Missing fields" });
  try {
    await pool.query(
      "INSERT INTO Feedback (FromUserId, ToUserId, ListingId, Rating, Comments) VALUES (?, ?, ?, ?, ?)",
      [fromUserId, toUserId, listingId || null, rating, comments || null]
    );
    res.json({ message: "✅ Feedback saved" });
  } catch (err) {
    console.error("/feedback", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/feedback/seller/:sellerId", async (req, res) => {
  const { sellerId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT F.FeedbackId, F.Rating, F.Comments, U.FullName AS BuyerName, L.Title AS ListingTitle, F.CreatedAt
       FROM Feedback F
       LEFT JOIN Users U ON F.FromUserId = U.UserId
       LEFT JOIN Listings L ON F.ListingId = L.ListingId
       WHERE F.ToUserId = ?
       ORDER BY F.CreatedAt DESC`,
      [sellerId]
    );
    res.json(rows);
  } catch (err) {
    console.error("/feedback/seller", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("Campus Exchange API running"));

const PORT = process.env.SERVER_PORT ? Number(process.env.SERVER_PORT) : 5000;
app.listen(PORT, () => console.log(`Server listening ${PORT}`));
