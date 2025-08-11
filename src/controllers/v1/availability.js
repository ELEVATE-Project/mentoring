// Dependencies
const availabilityService = require('@services/availability')

/**
 * A class representing Availability and its related operations.
 */
module.exports = class Availability {
	/**
	 * Create availability.
	 * @method
	 * @name create
	 * @param {Object} req - The request object containing the request body and decoded token.
	 * @returns {Promise<Object>} - The created availability object.
	 */
	async create(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const createdQuestion = await availabilityService.create(req.body, req.decodedToken, tenantCode)
			return createdQuestion
		} catch (error) {
			return error
		}
	}

	/**
	 * Update availability.
	 * @method
	 * @name update
	 * @param {Object} req - The request object containing the request parameters, body, and decoded token.
	 * @returns {Promise<Object>} - The updated availability object.
	 */
	async update(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			return await availabilityService.update(req.params.id, req.body, req.decodedToken, tenantCode)
		} catch (error) {
			return error
		}
	}
	/**
	 * delete availability.
	 * @method
	 * @name delete
	 * @param {Object} req - The request object containing the request parameters, body, and decoded token.
	 * @returns {Promise<Object>} - The updated availability object.
	 */
	async delete(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			return await availabilityService.delete(req.params.id, req.decodedToken, tenantCode)
		} catch (error) {
			return error
		}
	}

	/**
	 * Read availability.
	 * @method
	 * @name read
	 * @param {Object} req - The request object containing the request query and parameters.
	 * @returns {Promise<Object>} - The availability object.
	 */
	async read(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			return await availabilityService.read(req.query, req.params.id, tenantCode)
		} catch (error) {
			return error
		}
	}

	/**
	 * Check availability.
	 * @method
	 * @name isAvailable
	 * @param {Object} req - The request object containing the request query and parameters.
	 * @returns {Promise<Object>} - The availability status.
	 */
	async isAvailable(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			return await availabilityService.isAvailable(req.query, req.params.id, tenantCode)
		} catch (error) {
			return error
		}
	}

	/**
	 * Get available users.
	 * @method
	 * @name availableUsers
	 * @param {Object} req - The request object containing the request query and parameters.
	 * @returns {Promise<Object>} - The list of available users.
	 */
	async users(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			return await availabilityService.users(req.query, req.params.id, tenantCode)
		} catch (error) {
			return error
		}
	}
}
