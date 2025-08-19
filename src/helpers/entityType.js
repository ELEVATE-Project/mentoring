'use strict'

const entityTypeQueries = require('@database/queries/entityType')
const cacheHelper = require('@cache/helper')

module.exports = class UserHelper {
	/**
	 * Retrieves entity types for given org IDs and tenant.
	 * First tries cache; if not found, fetches from DB.
	 */
	static async findAllEntityTypes(orgIds, tenantCode = '', attributes) {
		try {
			const cachedEntities = []

			for (const orgId of orgIds) {
				const key = `entityType:${tenantCode}:${orgId}`
				const cachedData = await cacheHelper.redisGet(key)

				if (cachedData) {
					cachedEntities.push(cachedData)
				}
			}

			if (cachedEntities.length > 0) {
				return cachedEntities
			}

			// Fallback to DB if no cached data found
			const entities = await entityTypeQueries.findAllEntityTypes(orgIds, attributes)
			return entities || null
		} catch (err) {
			console.error('Error in findAllEntityTypes:', err)
			return null
		}
	}
}
