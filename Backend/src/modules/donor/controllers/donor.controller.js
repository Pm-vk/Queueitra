import donorService from "../services/donor.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

class DonorController {
  /**
   * @desc    Register a new donor
   * @route   POST /api/v1/donors
   * @access  CUSTOMER (self-register), STAFF, ADMIN, SUPER_ADMIN
   */
  createDonor = asyncHandler(async (req, res) => {
    const donor = await donorService.createDonor(req.body, req.user);

    return res
      .status(201)
      .json(new ApiResponse(201, "Donor registered successfully", { donor }));
  });

  /**
   * @desc    Get all donors (paginated, filterable, searchable)
   * @route   GET /api/v1/donors
   * @access  All authenticated users (CUSTOMER scoped to their own record)
   * @query   page, limit, search, bloodGroup, city, officeId, isEligible,
   *          isActive, sortBy, sortOrder
   */
  getAllDonors = asyncHandler(async (req, res) => {
    const {
      page,
      limit,
      search,
      bloodGroup,
      city,
      officeId,
      isEligible,
      isActive,
      sortBy,
      sortOrder,
    } = req.query;

    const options = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search: search || undefined,
      bloodGroup: bloodGroup || undefined,
      city: city || undefined,
      officeId: officeId || undefined,
      // Parse boolean strings from query params
      isEligible: isEligible !== undefined ? isEligible === "true" : undefined,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      sortBy: sortBy || undefined,
      sortOrder: sortOrder || undefined,
    };

    const result = await donorService.getAllDonors(options, req.user);

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Donors retrieved successfully", result)
      );
  });

  /**
   * @desc    Get a single donor by ID
   * @route   GET /api/v1/donors/:id
   * @access  All authenticated users (CUSTOMER scoped to their own)
   */
  getDonorById = asyncHandler(async (req, res) => {
    const donor = await donorService.getDonorById(req.params.id, req.user);

    return res
      .status(200)
      .json(new ApiResponse(200, "Donor retrieved successfully", { donor }));
  });

  /**
   * @desc    Update donor details
   * @route   PATCH /api/v1/donors/:id
   * @access  CUSTOMER (own profile only), STAFF, ADMIN, SUPER_ADMIN
   */
  updateDonor = asyncHandler(async (req, res) => {
    const donor = await donorService.updateDonor(
      req.params.id,
      req.body,
      req.user
    );

    return res
      .status(200)
      .json(new ApiResponse(200, "Donor updated successfully", { donor }));
  });

  /**
   * @desc    Soft delete a donor
   * @route   DELETE /api/v1/donors/:id
   * @access  ADMIN, SUPER_ADMIN
   */
  deleteDonor = asyncHandler(async (req, res) => {
    await donorService.deleteDonor(req.params.id, req.user);

    return res
      .status(200)
      .json(new ApiResponse(200, "Donor deleted successfully"));
  });

  /**
   * @desc    Activate a donor
   * @route   PATCH /api/v1/donors/:id/activate
   * @access  ADMIN, SUPER_ADMIN
   */
  activateDonor = asyncHandler(async (req, res) => {
    const donor = await donorService.activateDonor(req.params.id, req.user);

    return res
      .status(200)
      .json(new ApiResponse(200, "Donor activated successfully", { donor }));
  });

  /**
   * @desc    Deactivate a donor (without deletion)
   * @route   PATCH /api/v1/donors/:id/deactivate
   * @access  ADMIN, SUPER_ADMIN
   */
  deactivateDonor = asyncHandler(async (req, res) => {
    const donor = await donorService.deactivateDonor(req.params.id, req.user);

    return res
      .status(200)
      .json(new ApiResponse(200, "Donor deactivated successfully", { donor }));
  });

  /**
   * @desc    Reassign donor to a different office
   * @route   PATCH /api/v1/donors/:id/assign-office
   * @access  ADMIN, SUPER_ADMIN
   */
  assignDonorToOffice = asyncHandler(async (req, res) => {
    const donor = await donorService.assignDonorToOffice(
      req.params.id,
      req.body.officeId,
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Donor reassigned to office successfully", { donor })
      );
  });
}

export default new DonorController();
