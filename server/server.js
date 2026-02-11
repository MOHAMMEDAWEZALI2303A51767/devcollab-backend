require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require("express");
const connectDB = require("./config/database");


const app = express();

// connect database
connectDB();

app.use(express.json());

// health test route
app.get("/health", (req, res) => {
  res.json({ status: "Backend is running 🚀" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("============================================");
  console.log("  DevCollab Server");
  console.log("  Environment:", process.env.NODE_ENV || "development");
  console.log("  Port:", PORT);
  console.log("  API: http://localhost:" + PORT + "/api");
  console.log("  Health: http://localhost:" + PORT + "/health");
  console.log("============================================");
});
