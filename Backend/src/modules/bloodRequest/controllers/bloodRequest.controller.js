import bloodRequestService from "../services/bloodRequest.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

/**
 * Parse common list query options from req.query.
 * @param {Object} query
 * @returns {Object}
 */
const parseListOptions = (query) => {
  const {
    page,
    limit,
    search,
    officeId,
    bloodGroup,
    componentType,
    priority,
    status,
    dateFrom,
    dateTo,
    isActive,
    sortBy,
    sortOrder,
  } = query;

  return {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 10,
    search: search || undefined,
    officeId: officeId || undefined,
    bloodGroup: bloodGroup || undefined,
    componentType: componentType || undefined,
    priority: priority || undefined,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    isActive: isActive !== undefined ? isActive === "true" : undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
  };
};

class BloodRequestController {
  /**
   * @desc    Create a new blood request
   * @route   POST /api/v1/blood-requests
   * @access  STAFF, ADMIN, SUPER_ADMIN
   */
  createRequest = asyncHandler(async (req, res) => {
    const request = await bloodRequestService.createRequest(req.body, req.user);

    return res
      .status(201)
      .json(
        new ApiResponse(201, "Blood request created successfully", { request })
      );
  });

  /**
   * @desc    Get all blood requests (paginated, filterable, searchable)
   * @route   GET /api/v1/blood-requests
   * @access  STAFF (own), ADMIN, SUPER_ADMIN
   * @query   page, limit, search, officeId, bloodGroup, componentType,
   *          priority, status, dateFrom, dateTo, isActive, sortBy, sortOrder
   */
  getAllRequests = asyncHandler(async (req, res) => {
    const result = await bloodRequestService.getAllRequests(
      parseListOptions(req.query),
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Blood requests retrieved successfully", result)
      );
  });

  /**
   * @desc    Get blood request dashboard statistics
   * @route   GET /api/v1/blood-requests/dashboard
   * @access  ADMIN, SUPER_ADMIN
   * @query   officeId (optional) — scope dashboard to a specific office
   */
  getDashboard = asyncHandler(async (req, res) => {
    const { officeId } = req.query;
    const dashboard = await bloodRequestService.getDashboard(
      { officeId: officeId || null },
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Blood request dashboard retrieved successfully", dashboard)
      );
  });

  /**
   * @desc    Get a single blood request by ID
   * @route   GET /api/v1/blood-requests/:id
   * @access  STAFF (own), ADMIN, SUPER_ADMIN
   */
  getRequestById = asyncHandler(async (req, res) => {
    const request = await bloodRequestService.getRequestById(
      req.params.id,
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Blood request retrieved successfully", { request })
      );
  });

  /**
   * @desc    Update blood request fields
   * @route   PATCH /api/v1/blood-requests/:id
   * @access  STAFF (own PENDING only), ADMIN, SUPER_ADMIN
   */
  updateRequest = asyncHandler(async (req, res) => {
    const request = await bloodRequestService.updateRequest(
      req.params.id,
      req.body,
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Blood request updated successfully", { request })
      );
  });

  /**
   * @desc    Approve a blood request
   * @route   PATCH /api/v1/blood-requests/:id/approve
   * @access  ADMIN, SUPER_ADMIN
   */
  approveRequest = asyncHandler(async (req, res) => {
    const { remarks } = req.body;
    const request = await bloodRequestService.approveRequest(
      req.params.id,
      req.user,
      remarks
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Blood request approved successfully", { request })
      );
  });

  /**
   * @desc    Reject a blood request
   * @route   PATCH /api/v1/blood-requests/:id/reject
   * @access  ADMIN, SUPER_ADMIN
   */
  rejectRequest = asyncHandler(async (req, res) => {
    const { remarks } = req.body;
    const request = await bloodRequestService.rejectRequest(
      req.params.id,
      req.user,
      remarks
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Blood request rejected", { request })
      );
  });

  /**
   * @desc    Cancel a blood request
   * @route   PATCH /api/v1/blood-requests/:id/cancel
   * @access  STAFF (own, limited statuses), ADMIN, SUPER_ADMIN
   */
  cancelRequest = asyncHandler(async (req, res) => {
    const { remarks } = req.body;
    const request = await bloodRequestService.cancelRequest(
      req.params.id,
      req.user,
      remarks
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Blood request cancelled successfully", { request })
      );
  });

  /**
   * @desc    Allocate blood units to an approved/partial request
   *          Triggers the allocation engine and transaction workflow.
   * @route   PATCH /api/v1/blood-requests/:id/allocate
   * @access  ADMIN, SUPER_ADMIN
   */
  allocateBlood = asyncHandler(async (req, res) => {
    const result = await bloodRequestService.allocateBlood(
      req.params.id,
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Blood units allocated successfully", result)
      );
  });

  /**
   * @desc    Soft delete a blood request record
   * @route   DELETE /api/v1/blood-requests/:id
   * @access  ADMIN, SUPER_ADMIN
   */
  deleteRequest = asyncHandler(async (req, res) => {
    await bloodRequestService.deleteRequest(req.params.id, req.user);

    return res
      .status(200)
      .json(new ApiResponse(200, "Blood request deleted successfully"));
  });
}

export default new BloodRequestController();
