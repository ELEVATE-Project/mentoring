const { Op } = require('sequelize')

const Entity = require('../models/index').Entity
module.exports = class UserEntityData {
	static async createEntity(data, tenantCode) {
		// Ensure tenant_code is set in data
		data.tenant_code = tenantCode
		try {
			return await Entity.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findAllEntities(filter, tenantCode, options = {}) {
		try {
			// MANDATORY: Include tenant_code filtering
			filter.tenant_code = tenantCode
			return await Entity.findAll({
				where: filter,
				...options,
				raw: true,
			})
		} catch (error) {
			throw error
		}
	}

	static async updateOneEntity(whereClause, tenantCode, update, options = {}) {
		try {
			// MANDATORY: Include tenant_code in whereClause
			const where = { ...(whereClause || {}), tenant_code: tenantCode }
			const sanitized = { ...update }
			delete sanitized.tenant_code
			return await Entity.update(sanitized, {
				where,
				...options,
			})
		} catch (error) {
			throw error
		}
	}

	static async deleteOneEntityType(whereClause, tenantCode) {
		try {
			// MANDATORY: Include tenant_code in whereClause
			whereClause.tenant_code = tenantCode
			return await Entity.destroy({
				where: whereClause,
			})
		} catch (error) {
			throw error
		}
	}

	static async findEntityTypeById(filter, tenantCode) {
		try {
			const whereClause = { id: filter, tenant_code: tenantCode }
			const entityData = await Entity.findOne({ where: whereClause })
			return entityData
		} catch (error) {
			return error
		}
	}

	static async getAllEntities(filters, tenantCode, attributes, page, limit, search) {
		try {
			let whereClause = {
				...filters,
				// MANDATORY: Include tenant_code filtering
				tenant_code: tenantCode,
			}

			if (search) {
				whereClause[Op.or] = [{ label: { [Op.iLike]: `%${search}%` } }]
			}

			return await Entity.findAndCountAll({
				where: whereClause,
				attributes: attributes,
				offset: limit * (page - 1),
				limit: limit,
				order: [
					['created_at', 'DESC'],
					['id', 'ASC'],
				],
			})
		} catch (error) {
			throw error
		}
	}
}
