import Office from "../models/Office.js";

class OfficeRepository {
  /**
   * Insert a new office document into the database
   * @param {Object} officeData 
   * @returns {Promise<Object>} The created Office document
   */
  async createOffice(officeData) {
    try {
      return await Office.create(officeData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find an office by ID (returns a lean document for performance)
   * @param {string} id 
   * @returns {Promise<Object|null>} The Office document or null
   */
  async findOfficeById(id) {
    try {
      return await Office.findById(id).lean().exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a single office matching a name
   * @param {string} name 
   * @returns {Promise<Object|null>} The Office document or null
   */
  async findOfficeByName(name) {
    try {
      return await Office.findOne({ name }).lean().exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Query offices with pagination, filtering, text searching, and sorting
   * @param {Object} options Configuration parameters for query building
   * @returns {Promise<Object>} Paginated query metadata and collection
   */
  async findAllOffices(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        officeType,
        city,
        isActive = true,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const filter = {};

      if (isActive !== undefined) {
        filter.isActive = isActive;
      }

      if (officeType) {
        filter.officeType = officeType;
      }

      if (city) {
        filter.city = city;
      }

      if (search) {
        filter.$text = { $search: search };
      }

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

      const query = Office.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      if (search) {
        query.select({ score: { $meta: "textScore" } });
        sort.score = { $meta: "textScore" };
        query.sort(sort);
      }

      const [offices, total] = await Promise.all([
        query.exec(),
        Office.countDocuments(filter).exec(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        offices,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing office document
   * @param {string} id 
   * @param {Object} updateData 
   * @returns {Promise<Object|null>} The updated Office document
   */
  async updateOffice(id, updateData) {
    try {
      return await Office.findByIdAndUpdate(
        id,
        { $set: updateData },
        { returnDocument: "after", runValidators: true }
      ).exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Toggle the isActive state to false (Soft Delete)
   * @param {string} id 
   * @returns {Promise<Object|null>} The updated Office document
   */
  async softDeleteOffice(id) {
    try {
      return await Office.findByIdAndUpdate(
        id,
        { isActive: false },
        { returnDocument: "after" }
      ).exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Query nearby offices using a fast bounding-box geo calculation
   * @param {number} latitude 
   * @param {number} longitude 
   * @param {number} maxDistanceInMeters 
   * @param {Object} options Additional filtering/pagination options
   * @returns {Promise<Object>} Paginated collection of nearby offices
   */
  async findNearbyOffices(latitude, longitude, maxDistanceInMeters = 5000, options = {}) {
    try {
      // Approx 111,111 meters per degree of Latitude
      const latOffset = maxDistanceInMeters / 111111;
      
      // Calculate longitude degree offset based on current latitude cos
      const radLat = (latitude * Math.PI) / 180;
      const lonOffset = maxDistanceInMeters / (111111 * Math.cos(radLat));

      const minLat = latitude - latOffset;
      const maxLat = latitude + latOffset;
      const minLon = longitude - lonOffset;
      const maxLon = longitude + lonOffset;

      const {
        page = 1,
        limit = 10,
        search,
        officeType,
        city,
        isActive = true,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const filter = {
        latitude: { $gte: minLat, $lte: maxLat },
        longitude: { $gte: minLon, $lte: maxLon },
      };

      if (isActive !== undefined) {
        filter.isActive = isActive;
      }
      if (officeType) {
        filter.officeType = officeType;
      }
      if (city) {
        filter.city = city;
      }
      if (search) {
        filter.$text = { $search: search };
      }

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

      const [offices, total] = await Promise.all([
        Office.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        Office.countDocuments(filter).exec(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        offices,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Wrapper query for active offices
   * @param {Object} options 
   * @returns {Promise<Object>} Paginated active offices
   */
  async findActiveOffices(options = {}) {
    return await this.findAllOffices({ ...options, isActive: true });
  }
}

export default new OfficeRepository();
