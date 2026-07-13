import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

/**
 * @desc Get server health check status
 * @route GET /api/v1/health
 * @access Public
 */
const getHealthStatus = asyncHandler(async (req, res) => {
  const healthData = {
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    timestamp: Date.now(),
    nodeVersion: process.version,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, "Server is healthy", healthData));
});

export { getHealthStatus };
