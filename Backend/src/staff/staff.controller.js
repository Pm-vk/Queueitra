import staffService from "./staff.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

class StaffController {
  /**
   * @desc    Create a new staff member
   * @route   POST /api/v1/staff
   * @access  ADMIN, SUPER_ADMIN
   */
  createStaff = asyncHandler(async (req, res) => {
    const staff = await staffService.createStaff(req.body, req.user);

    return res
      .status(201)
      .json(new ApiResponse(201, "Staff member created successfully", { staff }));
  });

  /**
   * @desc    Get all staff members (paginated, filterable, searchable)
   * @route   GET /api/v1/staff
   * @access  Authenticated
   * @query   page, limit, officeId, isActive, designation, search, sortBy, sortOrder
   */
  getAllStaff = asyncHandler(async (req, res) => {
    const {
      page,
      limit,
      officeId,
      isActive,
      designation,
      search,
      sortBy,
      sortOrder,
    } = req.query;

    const options = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      officeId,
      // Parse isActive from query string to boolean; undefined means no filter
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      designation,
      search,
      sortBy,
      sortOrder,
    };

    const result = await staffService.getAllStaff(options);

    return res
      .status(200)
      .json(new ApiResponse(200, "Staff members retrieved successfully", result));
  });

  /**
   * @desc    Get a single staff member by ID
   * @route   GET /api/v1/staff/:id
   * @access  Authenticated
   */
  getStaffById = asyncHandler(async (req, res) => {
    const staff = await staffService.getStaffById(req.params.id);

    return res
      .status(200)
      .json(new ApiResponse(200, "Staff member retrieved successfully", { staff }));
  });

  /**
   * @desc    Update staff member details
   * @route   PATCH /api/v1/staff/:id
   * @access  ADMIN, SUPER_ADMIN
   */
  updateStaff = asyncHandler(async (req, res) => {
    const staff = await staffService.updateStaff(req.params.id, req.body, req.user);

    return res
      .status(200)
      .json(new ApiResponse(200, "Staff member updated successfully", { staff }));
  });

  /**
   * @desc    Soft delete a staff member
   * @route   DELETE /api/v1/staff/:id
   * @access  ADMIN, SUPER_ADMIN
   */
  deleteStaff = asyncHandler(async (req, res) => {
    await staffService.deleteStaff(req.params.id, req.user);

    return res
      .status(200)
      .json(new ApiResponse(200, "Staff member deleted successfully"));
  });

  /**
   * @desc    Activate a staff member
   * @route   PATCH /api/v1/staff/:id/activate
   * @access  ADMIN, SUPER_ADMIN
   */
  activateStaff = asyncHandler(async (req, res) => {
    const staff = await staffService.activateStaff(req.params.id, req.user);

    return res
      .status(200)
      .json(new ApiResponse(200, "Staff member activated successfully", { staff }));
  });

  /**
   * @desc    Deactivate a staff member (without deletion)
   * @route   PATCH /api/v1/staff/:id/deactivate
   * @access  ADMIN, SUPER_ADMIN
   */
  deactivateStaff = asyncHandler(async (req, res) => {
    const staff = await staffService.deactivateStaff(req.params.id, req.user);

    return res
      .status(200)
      .json(new ApiResponse(200, "Staff member deactivated successfully", { staff }));
  });

  /**
   * @desc    Reassign a staff member to a different office
   * @route   PATCH /api/v1/staff/:id/assign-office
   * @access  ADMIN, SUPER_ADMIN
   */
  assignStaffToOffice = asyncHandler(async (req, res) => {
    const staff = await staffService.assignStaffToOffice(
      req.params.id,
      req.body.officeId,
      req.user
    );

    return res
      .status(200)
      .json(new ApiResponse(200, "Staff member reassigned to office successfully", { staff }));
  });
}

export default new StaffController();
