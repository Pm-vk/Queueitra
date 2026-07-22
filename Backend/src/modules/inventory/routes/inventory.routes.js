import { Router } from "express";
import inventoryController from "../controllers/inventory.controller.js";
import { protect, authorize } from "../../../middlewares/auth.middleware.js";
import {
  validate,
  createInventorySchema,
  updateInventorySchema,
  updateStatusSchema,
  reserveSchema,
  issueSchema,
  transferSchema,
  discardSchema,
} from "../validations/inventory.validation.js";

const router = Router();

router.use(protect);

router.get(
  "/dashboard",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  inventoryController.getDashboard
);

router.post(
  "/",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(createInventorySchema),
  inventoryController.createUnit
);

router.get(
  "/",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  inventoryController.getAllUnits
);

router.get(
  "/:id",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  inventoryController.getUnitById
);

router.patch(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(updateInventorySchema),
  inventoryController.updateUnit
);

router.patch(
  "/:id/status",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(updateStatusSchema),
  inventoryController.updateStatus
);

router.patch(
  "/:id/reserve",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  validate(reserveSchema),
  inventoryController.reserveUnit
);

router.patch(
  "/:id/release-reservation",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  inventoryController.releaseReservation
);

router.patch(
  "/:id/issue",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  validate(issueSchema),
  inventoryController.markIssued
);

router.patch(
  "/:id/expire",
  authorize("ADMIN", "SUPER_ADMIN"),
  inventoryController.markExpired
);

router.patch(
  "/:id/discard",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(discardSchema),
  inventoryController.markDiscarded
);

router.patch(
  "/:id/transfer",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(transferSchema),
  inventoryController.transferUnit
);

router.delete(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  inventoryController.deleteUnit
);

export default router;
