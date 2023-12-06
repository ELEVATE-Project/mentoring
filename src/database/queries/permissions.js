const Permissions = require('@database/models/index').permissions
const { Op } = require('sequelize')

module.exports = class UserRolePermissionData {
	static async createPermission(data) {
		try {
			return await Permissions.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findPermissionById(id) {
		try {
			return await Permissions.findByPk(id)
		} catch (error) {
			throw error
		}
	}

	static async findAllPermissions(page, limit, search) {
		try {
			const offset = (page - 1) * limit

			const whereCondition = {
				code: { [Op.iLike]: `%${search}%` },
			}

			const options = {
				where: whereCondition,
				offset,
				limit,
				attributes: ['id', 'code', 'module', 'actions', 'status'],
			}

			const permissions = await Permissions.findAndCountAll(options)
			return permissions
		} catch (error) {
			throw error
		}
	}

	static async updatePermissionById(id, updatedata) {
		try {
			const [rowsUpdated, [updatedPermission]] = await Permissions.update(updatedata, {
				where: { id },
				returning: true,
			})

			if (rowsUpdated === 0) {
				throw new Error('PERMISSION_NOT_UPDATED')
			}

			return updatedPermission
		} catch (error) {
			throw error
		}
	}

	static async deletePermissionById(id) {
		try {
			const deletedRows = await Permissions.destroy({
				where: { id },
			})

			if (deletedRows === 0) {
				throw new Error('PERMISSION_NOT_DELETED')
			}

			return 'PERMISSION_DELETED_SUCCESSFULLY'
		} catch (error) {
			throw error
		}
	}

	static async findPermissionId(filter) {
		try {
			const entityData = await Permissions.findByPk(filter)
			return entityData
		} catch (error) {
			return error
		}
	}
}
