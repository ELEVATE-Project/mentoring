const defaultRuleService = require('@services/default-rule')

/**
 * Class representing Default Rule operations.
 */
module.exports = class DefaultRule {
	/**
	 * Creates a Default Rule.
	 * @method
	 * @async
	 * @name create
	 * @param {Object} req - The request object.
	 * @param {Object} req.body - The request payload.
	 * @param {Object} req.decodedToken - The decoded JWT token.
	 * @param {string} req.decodedToken.id - The user ID from the token.
	 * @param {string} req.decodedToken.organization_id - The organization ID from the token.
	 * @returns {Promise<Object>} - The Default Rule creation response.
	 */
	async create(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			return await defaultRuleService.create(
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_id,
				tenantCode
			)
		} catch (error) {
			console.error('Error creating Default Rule:', error)
			return error
		}
	}

	/**
	 * Updates a Default Rule.
	 * @method
	 * @async
	 * @name update
	 * @param {Object} req - The request object.
	 * @param {Object} req.body - The request payload.
	 * @param {Object} req.params - The request parameters.
	 * @param {string} req.params.id - The Default Rule ID to be updated.
	 * @param {Object} req.decodedToken - The decoded JWT token.
	 * @param {string} req.decodedToken.id - The user ID from the token.
	 * @param {string} req.decodedToken.organization_id - The organization ID from the token.
	 * @returns {Promise<Object>} - The Default Rule update response.
	 */
	async update(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			return await defaultRuleService.update(
				req.body,
				req.params.id,
				req.decodedToken.id,
				req.decodedToken.organization_id,
				tenantCode
			)
		} catch (error) {
			console.error('Error updating Default Rule:', error)
			return error
		}
	}

	/**
	 * Reads Default Rules.
	 * @method
	 * @async
	 * @name read
	 * @param {Object} req - The request object.
	 * @param {Object} req.params - The request parameters.
	 * @param {string} [req.params.id] - Optional Default Rule ID to read a specific rule.
	 * @param {Object} req.decodedToken - The decoded JWT token.
	 * @param {string} req.decodedToken.id - The user ID from the token.
	 * @param {string} req.decodedToken.organization_id - The organization ID from the token.
	 * @returns {Promise<Object>} - The entities.
	 */
	async read(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			if (req.params.id)
				return await defaultRuleService.readOne(req.params.id, req.decodedToken.organization_id, tenantCode)
			return await defaultRuleService.readAll(req.decodedToken.organization_id, tenantCode)
		} catch (error) {
			console.error('Error reading Default Rule:', error)
			return error
		}
	}

	/**
	 * Deletes a Default Rule.
	 * @method
	 * @async
	 * @name delete
	 * @param {Object} req - The request object.
	 * @param {Object} req.params - The request parameters.
	 * @param {string} req.params.id - The Default Rule ID to be deleted.
	 * @param {Object} req.decodedToken - The decoded JWT token.
	 * @param {string} req.decodedToken.organization_id - The organization ID from the token.
	 * @returns {Promise<Object>} - The Default Rule deletion response.
	 */
	async delete(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			return await defaultRuleService.delete(req.params.id, req.decodedToken.organization_id, tenantCode)
		} catch (error) {
			console.error('Error deleting Default Rule:', error)
			return error
		}
	}
}
