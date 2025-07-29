const { Op } = require('sequelize')

const Entity = require('../models/index').Entity
module.exports = class UserEntityData {
	static async createEntity(data) {
		try {
			return await Entity.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findAllEntities(filter, options = {}) {
		try {
			return await Entity.findAll({
				where: filter,
				...options,
				raw: true,
			})
		} catch (error) {
			throw error
		}
	}

	static async updateOneEntity(whereClause, update, options = {}) {
		try {
			return await Entity.update(update, {
				where: whereClause,
				...options,
			})
		} catch (error) {
			throw error
		}
	}

	static async deleteOneEntityType(whereClause) {
		try {
			return await Entity.destroy({
				where: whereClause,
			})
		} catch (error) {
			throw error
		}
	}

	static async findEntityTypeById(filter) {
		try {
			const entityData = await Entity.findByPk(filter)
			return entityData
		} catch (error) {
			return error
		}
	}

	static async getAllEntities(filters, attributes, page, limit, search) {
		try {
			let whereClause = {
				...filters,
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
