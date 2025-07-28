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
		console.error('Error creating DefaultRule:', error)
		throw error
	}
}

/**
 * Finds a single DefaultRule record based on the filter.
 * @param {Object} filter - The filter to find the DefaultRule.
 * @param {Object} [options={}] - Additional query options.
 * @returns {Promise<Object|Error>} The found DefaultRule or an error.
 */
exports.findOne = async (filter, tenantCode, options = {}) => {
	try {
		filter.tenant_code = tenantCode
		const res = await DefaultRule.findOne({
			where: filter,
			...options,
			raw: true,
		})
		return res
	} catch (error) {
		console.error('Error finding DefaultRule:', error)
		throw error
	}
}

/**
 * Updates a DefaultRule record based on the filter and update data.
 * @param {Object} filter - The filter to find the DefaultRule.
 * @param {Object} update - The data to update the DefaultRule with.
 * @param {Object} [options={}] - Additional query options.
 * @returns {Promise<[number, number]|Error>} The number of affected rows and rows affected or an error.
 */
exports.updateOne = async (filter, update, tenantCode, options = {}) => {
	try {
		filter.tenant_code = tenantCode
		return await DefaultRule.update(update, {
			where: filter,
			...options,
			individualHooks: true,
		})
	} catch (error) {
		console.error('Error updating DefaultRule:', error)
		throw error
	}
}

/**
 * Deletes a DefaultRule record based on the filter.
 * @param {Object} filter - The filter to find the DefaultRule.
 * @returns {Promise<number|Error>} The number of affected rows or an error.
 */
exports.deleteOne = async (filter, tenantCode) => {
	try {
		filter.tenant_code = tenantCode
		const result = await DefaultRule.destroy({
			where: filter,
		})
		return result
	} catch (error) {
		console.error('Error deleting DefaultRule:', error)
		throw error
	}
}

/**
 * Finds all DefaultRule records that match the filter.
 * @param {Object} filter - The filter to find the DefaultRules.
 * @param {Object} [options={}] - Additional query options.
 * @returns {Promise<Array<Object>|Error>} The found DefaultRules or an error.
 */
exports.findAndCountAll = async (filter, tenantCode, options = {}) => {
	try {
		filter.tenant_code = tenantCode
		return await DefaultRule.findAndCountAll({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		console.error('Error finding DefaultRules:', error)
		throw error
	}
}

/**
 * Finds all DefaultRule records that match the filter.
 * @param {Object} filter - The filter to find the DefaultRules.
 * @param {Object} [options={}] - Additional query options.
 * @returns {Promise<Array<Object>|Error>} The found DefaultRules or an error.
 */
exports.findAll = async (filter, tenantCode, options = {}) => {
	try {
		filter.tenant_code = tenantCode
		return await DefaultRule.findAll({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		console.error('Error finding DefaultRules:', error)
		throw error
	}
}
