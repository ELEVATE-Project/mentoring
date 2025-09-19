const Permissions = require('@database/models/index').Permission
const { Op } = require('sequelize')

module.exports = class permissionData {
	static async createPermission(data) {
		try {
			return await Permissions.create(data, { returning: true })
		} catch (error) {
			return error
		}
	}

	static async findPermissionById(id) {
		try {
			return await Permissions.findByPk(id)
		} catch (error) {
			return error
		}
	}

	static async findAllPermissions(filter, attributes, options = {}) {
		try {
			// Safe merge: filter cannot be overridden by options.where
			const { where: optionsWhere, ...otherOptions } = options

			const permissions = await Permissions.findAndCountAll({
				where: {
					...optionsWhere, // Allow additional where conditions
					...filter, // But main filter takes priority
				},
				attributes,
				...otherOptions,
			})
			return permissions
		} catch (error) {
			return error
		}
	}

	static async updatePermissions(filter, updateData) {
		try {
			const [rowsUpdated, [updatedPermission]] = await Permissions.update(updateData, {
				where: filter,
				returning: true,
			})
			return updatedPermission
		} catch (error) {
			return error
		}
	}

	static async deletePermissionById(id) {
		try {
			const deletedRows = await Permissions.destroy({
				where: { id },
				force: true,
			})

			return deletedRows
		} catch (error) {
			return error
		}
	}

	static async findPermissionId(filter) {
		try {
			const permissionData = await Permissions.findByPk(filter)
			return permissionData
		} catch (error) {
			return error
		}
	}

	static async find(filter, attributes) {
		const permissions = await Permissions.findAndCountAll({
			where: filter,
			attributes,
			raw: true,
		})
		return permissions
	}
}
