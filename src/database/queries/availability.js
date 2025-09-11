const Availability = require('../models/index').Availability

module.exports = class AvailabilityData {
	static async createAvailability(data, tenantCode) {
		try {
			return await Availability.create(data, { returning: true })
		} catch (error) {
			return error
		}
	}

	static async findAvailability(filter, projection = {}) {
		try {
			return await Availability.findAll({
				where: filter,
				attributes: projection,
				raw: true,
				order: [['start_time', 'ASC']],
			})
		} catch (error) {
			return error
		}
	}

	static async updateAvailability(filter, update, tenantCode, options = {}) {
		try {
			filter.tenant_code = tenantCode
			return await Availability.update(update, {
				where: filter,
				...options,
			})
		} catch (error) {
			throw error
		}
	}

	static async deleteAvailability(filter, tenantCode) {
		try {
			filter.tenant_code = tenantCode
			return await Availability.destroy({
				where: filter,
			})
		} catch (error) {
			return error
		}
	}
}
