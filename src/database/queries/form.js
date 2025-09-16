const Form = require('../models/index').Form
const { Op } = require('sequelize')

module.exports = class FormsData {
	static async createForm(data, tenantCode) {
		try {
			if (tenantCode) {
				data.tenant_code = tenantCode
			}
			let form = await Form.create(data, { returning: true })
			return form
		} catch (error) {
			return error
		}
	}

	static async findOne(filter, tenantCode, options = {}) {
		try {
			filter.tenant_code = tenantCode
			return await Form.findOne({
				where: filter,
				...options,
				raw: true,
			})
		} catch (error) {
			return error
		}
	}

	static async findFormsByFilter(filter, tenantCodes, options = {}) {
		try {
			const whereClause = {
				...filter,
				tenant_code: { [Op.in]: tenantCodes },
			}
			return await Form.findAll({
				where: whereClause,
				...options,
				raw: true,
			})
		} catch (error) {
			return error
		}
	}

	static async updateOneForm(filter, update, tenantCode, orgCode, options = {}) {
		try {
			filter.tenant_code = tenantCode
			if (orgCode) {
				filter.organization_code = orgCode
			}
			const [rowsAffected] = await Form.update(update, {
				where: filter,
				...options,
				individualHooks: true, // Pass 'individualHooks: true' option to ensure proper triggering of 'beforeUpdate' hook.
			})

			if (rowsAffected > 0) {
				return 'ENTITY_UPDATED'
			} else {
				return 'ENTITY_NOT_FOUND'
			}
		} catch (error) {
			return error
		}
	}

	static async findAllTypeFormVersion(tenantCode, orgCode) {
		try {
			const whereClause = { tenant_code: tenantCode }
			if (orgCode) {
				whereClause.organization_code = orgCode
			}
			const formData = await Form.findAll({
				where: whereClause,
				attributes: ['id', 'type', 'version'],
			})
			return formData
		} catch (error) {
			return error
		}
	}
}
