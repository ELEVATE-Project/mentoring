const RolePermissionMapping = require('@database/models/index').RolePermission

exports.create = async (data) => {
	try {
		return RolePermissionMapping.create(data, { returning: true })
	} catch (error) {
		return error
	}
}

exports.createWithPermissionValidation = async (roleTitle, permissionId, createdBy) => {
	try {
		// Sequelize approach: Validate permission exists and get required fields
		const Permission = RolePermissionMapping.sequelize.models.Permission
		const permission = await Permission.findByPk(permissionId, {
			attributes: ['id', 'module', 'request_type', 'api_path'],
		})

		if (!permission) {
			throw new Error('PERMISSION_NOT_FOUND')
		}

		// Create role permission mapping with validated permission data
		return await RolePermissionMapping.create(
			{
				role_title: roleTitle,
				permission_id: permissionId,
				module: permission.module,
				request_type: permission.request_type,
				api_path: permission.api_path,
				created_by: createdBy,
			},
			{ returning: true }
		)
	} catch (error) {
		return error
	}
}

exports.delete = async (filter) => {
	try {
		const deletedRows = await RolePermissionMapping.destroy({
			where: filter,
		})
		return deletedRows
	} catch (error) {
		return error
	}
}

exports.findAll = async (filter, attributes) => {
	try {
		const findRolePermisdions = await RolePermissionMapping.findAll({
			where: filter,
			attributes,
			raw: true,
		})
		return findRolePermisdions
	} catch (error) {
		return error
	}
}
