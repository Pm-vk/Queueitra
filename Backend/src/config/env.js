import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: process.env.PORT || 5000,

  NODE_ENV: process.env.NODE_ENV || "development",

  MONGODB_URI: process.env.MONGODB_URI,

  JWT_SECRET: process.env.JWT_SECRET,

  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,

  REDIS_URL: process.env.REDIS_URL
};
