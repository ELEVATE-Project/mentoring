const IdMapping = require('../models/index').IdMapping

module.exports = class IdMappingQueries {
	static async findOrCreate(data) {
		try {
			const existingRecord = await IdMapping.findOne({ where: { uuid: data.uuid }, raw: true })
			if (existingRecord) return [existingRecord, false]
			const newRecord = (await IdMapping.create(data, { returning: true })).get({ plain: true })
			return [newRecord, true]
		} catch (error) {
			console.error('Error creating or finding IdMapping:', error)
			throw new Error('Error creating or finding IdMapping')
		}
	}

	static async getUuidById(id) {
		try {
			const record = await IdMapping.findOne({
				where: { id },
			})
			return record ? record.uuid : null
		} catch (error) {
			console.error(`Error fetching UUID for ID ${id}:`, error)
			throw new Error(`Error fetching UUID for ID ${id}`)
		}
	}

	static async getUuidsByIds(ids) {
		try {
			const records = await IdMapping.findAll({
				where: {
					id: ids,
				},
			})
			return records.map((record) => record.uuid)
		} catch (error) {
			console.error('Error fetching UUIDs for IDs:', error)
			throw new Error('Error fetching UUIDs for IDs')
		}
	}

	static async getIdByUuid(uuid) {
		try {
			const record = await IdMapping.findOne({
				where: { uuid },
			})
			return record ? record.id : null
		} catch (error) {
			console.error(`Error fetching ID for UUID ${uuid}:`, error)
			throw new Error(`Error fetching ID for UUID ${uuid}`)
		}
	}

	static async getIdsByUuids(uuids) {
		try {
			const records = await IdMapping.findAll({
				where: {
					uuid: uuids,
				},
			})
			return records.map((record) => record.id)
		} catch (error) {
			console.error('Error fetching IDs for UUIDs:', error)
			throw new Error('Error fetching IDs for UUIDs')
		}
	}
}
