// =============================
//  CAMPUS EXCHANGE BACKEND - FINAL
// =============================

import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// =============================
//  DATABASE CONNECTION
// =============================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Check DB connection
pool
  .getConnection()
  .then(() => console.log("✅ Connected to Campus Exchange Database"))
  .catch((err) => console.error("❌ Database connection failed:", err.message));

// =============================
//  USER AUTHENTICATION ROUTES
// =============================

// Get all users (for login validation)
app.get("/users", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM Users");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register new user
app.post("/add-user", async (req, res) => {
  const { FullName, Email, PasswordHash } = req.body;
  try {
    await pool.query(
      "INSERT INTO Users (FullName, Email, PasswordHash) VALUES (?, ?, ?)",
      [FullName, Email, PasswordHash]
    );
    res.json({ message: "✅ User registered successfully!" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      res.status(400).json({ error: "⚠️ Email already exists." });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// =============================
//  LISTINGS (SELL / VIEW PRODUCTS)
// =============================

// Get all available listings
app.get("/listings", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT L.*, U.FullName AS SellerName
      FROM Listings L
      LEFT JOIN Users U ON L.SellerId = U.UserId
      WHERE L.Status = 'Available'
      ORDER BY L.CreatedAt DESC;
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new product listing (for logged-in seller)
app.post("/add-listing", async (req, res) => {
  const { sellerId, title, description, price, itemCondition } = req.body;
  try {
    await pool.query(
      `INSERT INTO Listings (SellerId, Title, Description, Price, ItemCondition)
       VALUES (?, ?, ?, ?, ?)`,
      [sellerId, title, description, price, itemCondition]
    );
    res.json({ message: "✅ Listing added successfully!" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================
//  PURCHASE ROUTE
// =============================

// Buy product (marks as sold)
app.post("/purchase", async (req, res) => {
  const { listingId, buyerId, amount, paymentMethod } = req.body;
  try {
    // Transaction-like behavior
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    const [listing] = await conn.query(
      "SELECT SellerId, Status FROM Listings WHERE ListingId = ? FOR UPDATE",
      [listingId]
    );

    if (!listing.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Item not found" });
    }

    if (listing[0].Status === "Sold") {
      await conn.rollback();
      return res
        .status(400)
        .json({ error: "❌ Item already sold. Please refresh." });
    }

    await conn.query(
      `INSERT INTO Transactions (ListingId, BuyerId, SellerId, Amount, PaymentMethod)
       VALUES (?, ?, ?, ?, ?)`,
      [listingId, buyerId, listing[0].SellerId, amount, paymentMethod]
    );

    await conn.query(
      "UPDATE Listings SET Status = 'Sold' WHERE ListingId = ?",
      [listingId]
    );

    await conn.commit();
    res.json({ message: "✅ Purchase successful!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
//  FEEDBACK SYSTEM
// =============================

// Add feedback after purchase
app.post("/feedback", async (req, res) => {
  const { fromUserId, toUserId, listingId, rating, comments } = req.body;
  try {
    await pool.query(
      `INSERT INTO Feedback (FromUserId, ToUserId, ListingId, Rating, Comments)
       VALUES (?, ?, ?, ?, ?)`,
      [fromUserId, toUserId, listingId, rating, comments]
    );
    res.json({ message: "⭐ Feedback submitted successfully!" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get average rating of seller
app.get("/rating/:sellerId", async (req, res) => {
  const { sellerId } = req.params;
  try {
    const [[result]] = await pool.query(
      "SELECT AVG(Rating) AS avgRating FROM Feedback WHERE ToUserId = ?",
      [sellerId]
    );
    res.json({ avgRating: result.avgRating || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
//  DEFAULT ROUTE
// =============================
app.get("/", (req, res) => {
  res.send("🚀 Campus Exchange API is up and running!");
});

// =============================
//  START SERVER
// =============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Campus Exchange Server running on port ${PORT}`);
});
