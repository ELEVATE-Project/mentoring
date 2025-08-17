const Form = require('../models/index').Form

module.exports = class FormsData {
	static async createForm(data, tenantCode) {
		try {
			data.tenant_code = tenantCode
			let form = await Form.create(data, { returning: true })
			return form
		} catch (error) {
			throw error
		}
	}

	static async findOneForm(filter, tenantCode, orgCode = null) {
		try {
			filter.tenant_code = tenantCode
			if (orgCode) {
				filter.organization_code = orgCode
			}
			const formData = await Form.findOne({
				where: filter,
				raw: true,
			})
			return formData
		} catch (error) {
			throw error
		}
	}

	static async updateOneForm(filter, update, tenantCode, orgCode = null, options = {}) {
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
			throw error
		}
	}

	static async findAllTypeFormVersion(tenantCode, orgCode = null) {
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
			throw error
		}
	}
}
