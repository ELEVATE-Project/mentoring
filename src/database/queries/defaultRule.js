const DefaultRule = require('@database/models/index').DefaultRule
const { Op } = require('sequelize')

/**
 * Creates a new DefaultRule record.
 * @param {Object} data - The data to create the DefaultRule with.
 * @returns {Promise<Object|Error>} The created DefaultRule or an error.
 */
exports.create = async (data, tenantCode) => {
	try {
		data.tenant_code = tenantCode
		return await DefaultRule.create(data)
	} catch (error) {
		throw error
	}
}

/**
 * Finds a single DefaultRule record based on the filter.
 * @param {Object} filter - The filter to find the DefaultRule (should include tenant_code).
 * @param {Object} [options={}] - Additional query options.
 * @returns {Promise<Object|Error>} The found DefaultRule or an error.
 */
exports.findOne = async (filter, options = {}) => {
	try {
		const res = await DefaultRule.findOne({
			where: filter,
			...options,
			raw: true,
		})
		return res
	} catch (error) {
		throw error
	}
}

/**
 * Updates a DefaultRule record based on the filter and update data.
 * @param {Object} filter - The filter to find the DefaultRule (should include tenant_code).
 * @param {Object} update - The data to update the DefaultRule with.
 * @param {Object} [options={}] - Additional query options.
 * @returns {Promise<[number, number]|Error>} The number of affected rows and rows affected or an error.
 */
exports.updateOne = async (filter, update, options = {}) => {
	try {
		return await DefaultRule.update(update, {
			where: filter,
			...options,
			individualHooks: true,
		})
	} catch (error) {
		throw error
	}
}

/**
 * Deletes a DefaultRule record based on the filter.
 * @param {Object} filter - The filter to find the DefaultRule (should include tenant_code).
 * @returns {Promise<number|Error>} The number of affected rows or an error.
 */
exports.deleteOne = async (filter) => {
	try {
		const result = await DefaultRule.destroy({
			where: filter,
		})
		return result
	} catch (error) {
		throw error
	}
}

/**
 * Finds all DefaultRule records that match the filter.
 * @param {Object} filter - The filter to find the DefaultRules (should include tenant_code).
 * @param {Object} [options={}] - Additional query options.
 * @returns {Promise<Array<Object>|Error>} The found DefaultRules or an error.
 */
exports.findAndCountAll = async (filter, options = {}) => {
	try {
		return await DefaultRule.findAndCountAll({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		throw error
	}
}

/**
 * Finds all DefaultRule records that match the filter.
 * @param {Object} filter - The filter to find the DefaultRules (should include tenant_code).
 * @param {Object} [options={}] - Additional query options.
 * @returns {Promise<Array<Object>|Error>} The found DefaultRules or an error.
 */
exports.findAll = async (filter, tenantCode = null, options = {}) => {
	try {
		// Only add tenant_code if tenantCode is provided (DefaultRule may not need tenant filtering)
		if (tenantCode) {
			filter.tenant_code = tenantCode
		}
		return await DefaultRule.findAll({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		throw error
	}
}
