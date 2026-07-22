import donationService from "../services/donation.service.js";
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
    staffId,
    bloodGroup,
    donationType,
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
    staffId: staffId || undefined,
    bloodGroup: bloodGroup || undefined,
    donationType: donationType || undefined,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    isActive: isActive !== undefined ? isActive === "true" : undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
  };
};

class DonationController {
  /**
   * @desc    Create a new donation record
   * @route   POST /api/v1/donations
   * @access  STAFF, ADMIN, SUPER_ADMIN
   */
  createDonation = asyncHandler(async (req, res) => {
    const donation = await donationService.createDonation(req.body, req.user);

    return res
      .status(201)
      .json(
        new ApiResponse(201, "Donation record created successfully", { donation })
      );
  });

  /**
   * @desc    Get all donations (paginated, filterable, searchable)
   * @route   GET /api/v1/donations
   * @access  All authenticated (CUSTOMER scoped to own)
   * @query   page, limit, search, officeId, staffId, bloodGroup, donationType,
   *          status, dateFrom, dateTo, isActive, sortBy, sortOrder
   */
  getAllDonations = asyncHandler(async (req, res) => {
    const result = await donationService.getAllDonations(
      parseListOptions(req.query),
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Donations retrieved successfully", result)
      );
  });

  /**
   * @desc    Get donation history (terminal statuses: COMPLETED, FAILED, REJECTED)
   * @route   GET /api/v1/donations/history
   * @access  All authenticated (CUSTOMER scoped to own)
   */
  getDonationHistory = asyncHandler(async (req, res) => {
    const result = await donationService.getDonationHistory(
      parseListOptions(req.query),
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Donation history retrieved successfully", result)
      );
  });

  /**
   * @desc    Get a single donation by ID
   * @route   GET /api/v1/donations/:id
   * @access  All authenticated (CUSTOMER scoped to own)
   */
  getDonationById = asyncHandler(async (req, res) => {
    const donation = await donationService.getDonationById(
      req.params.id,
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Donation retrieved successfully", { donation })
      );
  });

  /**
   * @desc    Update donation fields (vitals, remarks, staffId)
   * @route   PATCH /api/v1/donations/:id
   * @access  ADMIN, SUPER_ADMIN
   */
  updateDonation = asyncHandler(async (req, res) => {
    const donation = await donationService.updateDonation(
      req.params.id,
      req.body,
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Donation updated successfully", { donation })
      );
  });

  /**
   * @desc    Update donation status (advances state machine)
   *          When status → COMPLETED, runs the full transactional workflow:
   *          updates appointment, donor lastDonationDate, eligibility,
   *          and creates a BloodInventory record.
   * @route   PATCH /api/v1/donations/:id/status
   * @access  STAFF, ADMIN, SUPER_ADMIN
   */
  updateDonationStatus = asyncHandler(async (req, res) => {
    const { status, remarks, completedAt } = req.body;

    const donation = await donationService.updateDonationStatus(
      req.params.id,
      status,
      req.user,
      remarks,
      completedAt
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Donation status updated successfully", { donation })
      );
  });

  /**
   * @desc    Soft delete a donation record
   * @route   DELETE /api/v1/donations/:id
   * @access  ADMIN, SUPER_ADMIN
   */
  deleteDonation = asyncHandler(async (req, res) => {
    await donationService.deleteDonation(req.params.id, req.user);

    return res
      .status(200)
      .json(new ApiResponse(200, "Donation deleted successfully"));
  });
}

export default new DonationController();
