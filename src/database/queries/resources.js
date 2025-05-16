const Resources = require('../models/index').Resources

module.exports = class ResourcessData {
	static async bulkCreate(data) {
		try {
			const resources = await Resources.bulkCreate(data, {
				returning: true, // to return the inserted records
			})
			return resources
		} catch (error) {
			return error
		}
	}

	static async create(data) {
		try {
			const resources = await Resources.create(data, { returning: true })
			return resources
		} catch (error) {
			return error
		}
	}

	static async findOneResources(filter, projection = {}) {
		try {
			const ResourcesData = await Resources.findOne({
				where: filter,
				attributes: projection,
				raw: true,
			})
			return ResourcesData
		} catch (error) {
			return error
		}
	}

	static async deleteResource(sessionId, projection = {}) {
		try {
			const ResourcesData = await Resources.destroy({
				where: { session_id: sessionId },
				raw: true,
			})
			return ResourcesData
		} catch (error) {
			return error
		}
	}

	static async deleteResourceById(resourceId, sessionId) {
		try {
			const ResourcesData = await Resources.destroy({
				where: { id: resourceId, session_id: sessionId },
				raw: true,
			})
			return ResourcesData
		} catch (error) {
			return error
		}
	}

	static async find(filter, projection = {}) {
		try {
			const ResourcesData = await Resources.findAll({
				where: { ...filter, deleted_at: null },
				attributes: projection,
				raw: true,
			})
			return ResourcesData
		} catch (error) {
			return error
		}
	}
}
