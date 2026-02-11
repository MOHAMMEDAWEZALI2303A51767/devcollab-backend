require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");

// 👇 import routes
const routes = require("./routes");

const app = express();

// connect database
connectDB();

// CORS
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://devcollab-frontend-three.vercel.app"
  ],
  credentials: true
}));

app.use(express.json());

// 👇 API routes mount (THIS WAS MISSING)
app.use("/api", routes);

// health test route
app.get("/health", (req, res) => {
  res.json({ status: "Backend is running 🚀" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("============================================");
  console.log("DevCollab Server running 🚀");
  console.log("============================================");
});
