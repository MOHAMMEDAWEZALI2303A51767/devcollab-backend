require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler"); // ⭐ ADD THIS

const app = express();

connectDB();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.CLIENT_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS not allowed"));
  },
  methods: ["GET","POST","PUT","DELETE","PATCH","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

app.use("/api", routes);

app.get("/health", (req, res) => {
  res.json({ status: "Backend is running 🚀" });
});

app.use(errorHandler);   // ⭐⭐⭐ MOST IMPORTANT LINE ⭐⭐⭐

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("DevCollab Server running 🚀");
});
