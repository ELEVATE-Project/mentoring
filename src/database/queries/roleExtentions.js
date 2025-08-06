const RoleExtension = require('@database/models/index').RoleExtension

module.exports = class RoleExtensionService {
	static async createRoleExtension(data, userId, organizationId, tenantCode) {
		try {
			data.tenant_code = tenantCode
			data.organization_code = organizationId
			return await RoleExtension.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findRoleExtensionByTitle(title, tenantCode) {
		try {
			return await RoleExtension.findOne({
				where: { title, tenant_code: tenantCode },
			})
		} catch (error) {
			throw error
		}
	}

	static async findAllRoleExtensions(filter = {}, tenantCode, attributes = null, options = {}) {
		try {
			filter.tenant_code = tenantCode
			return await RoleExtension.findAndCountAll({
				where: filter,
				attributes,
				...options,
			})
		} catch (error) {
			throw error
		}
	}

	static async updateRoleExtension(filter, updateData, userId, organizationId, tenantCode) {
		try {
			filter.tenant_code = tenantCode
			const [rowsUpdated, [updatedRoleExtension]] = await RoleExtension.update(updateData, {
				where: filter,
				returning: true,
			})
			return updatedRoleExtension
		} catch (error) {
			throw error
		}
	}

	static async deleteRoleExtension(title, tenantCode) {
		try {
			const deletedRows = await RoleExtension.destroy({
				where: { title, tenant_code: tenantCode },
			})
			return deletedRows // Soft delete (paranoid enabled)
		} catch (error) {
			throw error
		}
	}
}
