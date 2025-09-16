const Form = require('../models/index').Form
const { getDefaults } = require('@helpers/getDefaultOrgId')

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

	static async findOneForm(filter, tenantCode, orgCode) {
		try {
			if (orgCode) {
				filter.organization_code = orgCode
			}
			filter.tenant_code = tenantCode

			// First try to find form for specific tenant
			let formData = await Form.findOne({
				where: filter,
				raw: true,
			})

			// If no form found and not already using default tenant, try default tenant
			if (!formData && tenantCode !== (await getDefaults()).tenantCode) {
				const defaults = await getDefaults()
				const defaultFilter = { ...filter, tenant_code: defaults.tenantCode }
				formData = await Form.findOne({
					where: defaultFilter,
					raw: true,
				})
			}

			return formData
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
