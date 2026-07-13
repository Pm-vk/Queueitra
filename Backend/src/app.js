import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

// Routes & Middlewares
import apiRouter from "./routes/index.js";
import notFound from "./middlewares/notFound.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";

const app = express();

app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

// Root landing route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Queutra API 🚀"
  });
});

// API Routes
app.use("/api", apiRouter);

// Error & 404 handlers
app.use(notFound);
app.use(errorHandler);

export default app;

