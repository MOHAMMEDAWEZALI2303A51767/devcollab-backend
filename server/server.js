require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require("express");
const cors = require("cors");              // ✅ MISSING LINE
const connectDB = require("./config/database");

const app = express();

// connect database
connectDB();

// ✅ CORRECT CORS (with REAL Vercel URL)
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://devcollab-frontend-three.vercel.app"
  ],
  credentials: true
}));

app.use(express.json());

// health test route
app.get("/health", (req, res) => {
  res.json({ status: "Backend is running 🚀" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("============================================");
  console.log("  DevCollab Server");
  console.log("  Environment:", process.env.NODE_ENV || "production");
  console.log("  Port:", PORT);
  console.log("  API running");
  console.log("============================================");
});
