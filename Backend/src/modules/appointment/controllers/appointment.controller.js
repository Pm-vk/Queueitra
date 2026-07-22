import appointmentService from "../services/appointment.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

/**
 * Extract common list query options from req.query.
 * Centralised so all list controllers share identical parsing logic.
 * @param {Object} query - req.query
 * @returns {Object}
 */
const parseListOptions = (query) => {
  const {
    page,
    limit,
    search,
    officeId,
    staffId,
    status,
    dateFrom,
    dateTo,
    appointmentDate,
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
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    appointmentDate: appointmentDate || undefined,
    isActive: isActive !== undefined ? isActive === "true" : undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
  };
};

class AppointmentController {
  /**
   * @desc    Book a new appointment
   * @route   POST /api/v1/appointments
   * @access  CUSTOMER (own donor), STAFF, ADMIN, SUPER_ADMIN
   */
  createAppointment = asyncHandler(async (req, res) => {
    const appointment = await appointmentService.createAppointment(
      req.body,
      req.user
    );

    return res
      .status(201)
      .json(
        new ApiResponse(201, "Appointment booked successfully", { appointment })
      );
  });

  /**
   * @desc    Get all appointments
   * @route   GET /api/v1/appointments
   * @access  All authenticated (CUSTOMER scoped to own)
   * @query   page, limit, search, officeId, staffId, status, dateFrom, dateTo,
   *          appointmentDate, isActive, sortBy, sortOrder
   */
  getAllAppointments = asyncHandler(async (req, res) => {
    const result = await appointmentService.getAllAppointments(
      parseListOptions(req.query),
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Appointments retrieved successfully", result)
      );
  });

  /**
   * @desc    Get upcoming appointments (date >= today, active statuses)
   * @route   GET /api/v1/appointments/upcoming
   * @access  All authenticated
   */
  getUpcomingAppointments = asyncHandler(async (req, res) => {
    const result = await appointmentService.getUpcomingAppointments(
      parseListOptions(req.query),
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Upcoming appointments retrieved successfully",
          result
        )
      );
  });

  /**
   * @desc    Get today's appointments
   * @route   GET /api/v1/appointments/today
   * @access  All authenticated
   */
  getTodaysAppointments = asyncHandler(async (req, res) => {
    const result = await appointmentService.getTodaysAppointments(
      parseListOptions(req.query),
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Today's appointments retrieved successfully", result)
      );
  });

  /**
   * @desc    Get appointment history (COMPLETED, CANCELLED, NO_SHOW)
   * @route   GET /api/v1/appointments/history
   * @access  All authenticated
   */
  getAppointmentHistory = asyncHandler(async (req, res) => {
    const result = await appointmentService.getAppointmentHistory(
      parseListOptions(req.query),
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Appointment history retrieved successfully", result)
      );
  });

  /**
   * @desc    Get a single appointment by ID
   * @route   GET /api/v1/appointments/:id
   * @access  All authenticated (CUSTOMER scoped to own)
   */
  getAppointmentById = asyncHandler(async (req, res) => {
    const appointment = await appointmentService.getAppointmentById(
      req.params.id,
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Appointment retrieved successfully", { appointment })
      );
  });

  /**
   * @desc    Update general appointment fields (remarks, staffId)
   * @route   PATCH /api/v1/appointments/:id
   * @access  ADMIN, SUPER_ADMIN
   */
  updateAppointment = asyncHandler(async (req, res) => {
    const appointment = await appointmentService.updateAppointment(
      req.params.id,
      req.body,
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Appointment updated successfully", { appointment })
      );
  });

  /**
   * @desc    Update appointment status
   * @route   PATCH /api/v1/appointments/:id/status
   * @access  CUSTOMER (cancel own only), STAFF, ADMIN, SUPER_ADMIN
   */
  updateAppointmentStatus = asyncHandler(async (req, res) => {
    const { status, remarks } = req.body;

    const appointment = await appointmentService.updateAppointmentStatus(
      req.params.id,
      status,
      req.user,
      remarks
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Appointment status updated successfully", {
          appointment,
        })
      );
  });

  /**
   * @desc    Cancel an appointment
   * @route   PATCH /api/v1/appointments/:id/cancel
   * @access  CUSTOMER (own), STAFF, ADMIN, SUPER_ADMIN
   */
  cancelAppointment = asyncHandler(async (req, res) => {
    const { remarks } = req.body;

    const appointment = await appointmentService.cancelAppointment(
      req.params.id,
      req.user,
      remarks
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Appointment cancelled successfully", { appointment })
      );
  });

  /**
   * @desc    Reschedule an appointment to a new date and/or time slot
   * @route   PATCH /api/v1/appointments/:id/reschedule
   * @access  ADMIN, SUPER_ADMIN
   */
  rescheduleAppointment = asyncHandler(async (req, res) => {
    const appointment = await appointmentService.rescheduleAppointment(
      req.params.id,
      req.body,
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Appointment rescheduled successfully", {
          appointment,
        })
      );
  });

  /**
   * @desc    Assign a staff member to an appointment
   * @route   PATCH /api/v1/appointments/:id/assign-staff
   * @access  STAFF (self only), ADMIN, SUPER_ADMIN
   */
  assignStaff = asyncHandler(async (req, res) => {
    const appointment = await appointmentService.assignStaff(
      req.params.id,
      req.body.staffId,
      req.user
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Staff assigned to appointment successfully", {
          appointment,
        })
      );
  });
}

export default new AppointmentController();
