import inventoryService from "../services/inventory.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

const parseListOptions = (query) => {
  const {
    page,
    limit,
    search,
    bloodUnitId,
    bloodGroup,
    componentType,
    status,
    officeId,
    collectionDateFrom,
    collectionDateTo,
    expiryDateFrom,
    expiryDateTo,
    isActive,
    sortBy,
    sortOrder,
  } = query;

  return {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 10,
    search: search || undefined,
    bloodUnitId: bloodUnitId || undefined,
    bloodGroup: bloodGroup || undefined,
    componentType: componentType || undefined,
    status: status || undefined,
    officeId: officeId || undefined,
    collectionDateFrom: collectionDateFrom || undefined,
    collectionDateTo: collectionDateTo || undefined,
    expiryDateFrom: expiryDateFrom || undefined,
    expiryDateTo: expiryDateTo || undefined,
    isActive: isActive !== undefined ? isActive === "true" : undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
  };
};

class InventoryController {
  createUnit = asyncHandler(async (req, res) => {
    const unit = await inventoryService.createInventoryUnit(req.body, req.user);
    return res
      .status(201)
      .json(new ApiResponse(201, "Inventory unit created successfully", { unit }));
  });

  getAllUnits = asyncHandler(async (req, res) => {
    const result = await inventoryService.getAllUnits(
      parseListOptions(req.query),
      req.user
    );
    return res
      .status(200)
      .json(new ApiResponse(200, "Inventory units retrieved successfully", result));
  });

  getDashboard = asyncHandler(async (req, res) => {
    const { officeId } = req.query;
    const dashboard = await inventoryService.getDashboard(
      { officeId: officeId || null },
      req.user
    );
    return res
      .status(200)
      .json(
        new ApiResponse(200, "Inventory dashboard retrieved successfully", dashboard)
      );
  });

  getUnitById = asyncHandler(async (req, res) => {
    const unit = await inventoryService.getUnitById(req.params.id, req.user);
    return res
      .status(200)
      .json(new ApiResponse(200, "Inventory unit retrieved successfully", { unit }));
  });

  updateUnit = asyncHandler(async (req, res) => {
    const unit = await inventoryService.updateUnit(
      req.params.id,
      req.body,
      req.user
    );
    return res
      .status(200)
      .json(new ApiResponse(200, "Inventory unit updated successfully", { unit }));
  });

  updateStatus = asyncHandler(async (req, res) => {
    const { status, remarks } = req.body;
    const unit = await inventoryService.updateStatus(
      req.params.id,
      status,
      req.user,
      remarks
    );
    return res
      .status(200)
      .json(
        new ApiResponse(200, "Inventory unit status updated successfully", { unit })
      );
  });

  reserveUnit = asyncHandler(async (req, res) => {
    const { reservedFor, remarks } = req.body;
    const unit = await inventoryService.reserveUnit(
      req.params.id,
      reservedFor,
      req.user,
      remarks
    );
    return res
      .status(200)
      .json(new ApiResponse(200, "Inventory unit reserved successfully", { unit }));
  });

  releaseReservation = asyncHandler(async (req, res) => {
    const { remarks } = req.body;
    const unit = await inventoryService.releaseReservation(
      req.params.id,
      req.user,
      remarks
    );
    return res
      .status(200)
      .json(
        new ApiResponse(200, "Inventory unit reservation released successfully", { unit })
      );
  });

  markIssued = asyncHandler(async (req, res) => {
    const { issuedTo, remarks } = req.body;
    const unit = await inventoryService.markIssued(
      req.params.id,
      issuedTo,
      req.user,
      remarks
    );
    return res
      .status(200)
      .json(new ApiResponse(200, "Inventory unit marked as issued", { unit }));
  });

  markExpired = asyncHandler(async (req, res) => {
    const { remarks } = req.body;
    const unit = await inventoryService.markExpired(
      req.params.id,
      req.user,
      remarks
    );
    return res
      .status(200)
      .json(new ApiResponse(200, "Inventory unit marked as expired", { unit }));
  });

  markDiscarded = asyncHandler(async (req, res) => {
    const { remarks } = req.body;
    const unit = await inventoryService.markDiscarded(
      req.params.id,
      remarks,
      req.user
    );
    return res
      .status(200)
      .json(new ApiResponse(200, "Inventory unit marked as discarded", { unit }));
  });

  transferUnit = asyncHandler(async (req, res) => {
    const { toOfficeId, remarks } = req.body;
    const unit = await inventoryService.transferUnit(
      req.params.id,
      toOfficeId,
      req.user,
      remarks
    );
    return res
      .status(200)
      .json(new ApiResponse(200, "Inventory unit transferred successfully", { unit }));
  });

  deleteUnit = asyncHandler(async (req, res) => {
    await inventoryService.deleteUnit(req.params.id, req.user);
    return res
      .status(200)
      .json(new ApiResponse(200, "Inventory unit deleted successfully"));
  });
}

export default new InventoryController();
