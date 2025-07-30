const Modules = require('@database/models/index').Module
const { Op } = require('sequelize')

module.exports = class UserRoleModulesData {
	static async createModules(data, tenantCode) {
		try {
			return await Modules.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findModulesById(id, tenantCode) {
		try {
			return await Modules.findOne({ where: { id, tenant_code: tenantCode } })
		} catch (error) {
			throw error
		}
	}

	static async findAllModules(filter, attributes, options, tenantCode) {
		try {
			// Ensure tenant_code is always included in the filter
			filter.tenant_code = tenantCode
			const permissions = await Modules.findAndCountAll({
				where: filter,
				attributes,
				...options,
			})
			return permissions
		} catch (error) {
			throw error
		}
	}

	static async updateModules(filter, updatedata, tenantCode) {
		try {
			const [rowsUpdated, [updatedModules]] = await Modules.update(updatedata, {
				where: filter,
				returning: true,
				raw: true,
			})
			return updatedModules
		} catch (error) {
			throw error
		}
	}

	static async deleteModulesById(id, tenantCode) {
		try {
			const deletedRows = await Modules.destroy({
				where: { id: id, tenant_code: tenantCode },
				individualHooks: true,
			})
			return deletedRows
		} catch (error) {
			throw error
		}
	}
}
