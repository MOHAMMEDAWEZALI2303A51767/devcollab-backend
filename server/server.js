require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");
const routes = require("./routes");

const app = express();

// Connect MongoDB
connectDB();


// 🌍 Allowed origins (LOCAL + PRODUCTION)
const allowedOrigins = [
  "http://localhost:5173",                      // local dev
  "https://devcollab-frontend-three.vercel.app" // production frontend
];

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (health checks, curl, postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","PATCH","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());


// 🔗 API ROUTES
app.use("/api", routes);


// ❤️ Health check route (Render uses this)
app.get("/health", (req, res) => {
  res.json({ status: "Backend is running 🚀" });
});


// 🚀 Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("=================================");
  console.log(" DevCollab Server running 🚀");
  console.log(" Port:", PORT);
  console.log("=================================");
});
