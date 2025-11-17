// Dependencies
const httpStatusCode = require('@generics/http-status')
const entityTypeQueries = require('../database/queries/entityType')
const { Op } = require('sequelize')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const responses = require('@helpers/responses')
const cacheHelper = require('@generics/cacheHelper')
const common = require('@constants/common')

/**
 * Get entity types and entities with cache-first strategy and fallback
 * @method
 * @name getEntityTypesAndEntitiesWithCache
 * @param {Object} originalFilter - complete original database filter
 * @param {Array} tenantCodes - tenant codes array
 * @param {String} modelName - model name (optional, for cache optimization)
 * @returns {JSON} - Entity types with entities
 */
async function getEntityTypesAndEntitiesWithCache(originalFilter, tenantCodes, modelName = null) {
	try {
		// If no modelName provided, use direct database query
		if (!modelName) {
			return await entityTypeQueries.findUserEntityTypesAndEntities(originalFilter, tenantCodes)
		}

		// Extract core filter components for cache key
		const orgCodes = Array.isArray(originalFilter.organization_code?.[Op.in])
			? originalFilter.organization_code[Op.in]
			: [originalFilter.organization_code]

		if (!orgCodes || orgCodes.length === 0) {
			return await entityTypeQueries.findUserEntityTypesAndEntities(originalFilter, tenantCodes)
		}

		const defaults = await getDefaults()
		if (!defaults.orgCode || !defaults.tenantCode) {
			return await entityTypeQueries.findUserEntityTypesAndEntities(originalFilter, tenantCodes)
		}

		// Ensure arrays include defaults
		const orgCodeArray = Array.isArray(orgCodes) ? [...orgCodes] : [orgCodes]
		const tenantCodeArray = Array.isArray(tenantCodes) ? [...tenantCodes] : [tenantCodes]

		if (!orgCodeArray.includes(defaults.orgCode)) {
			orgCodeArray.push(defaults.orgCode)
		}
		if (!tenantCodeArray.includes(defaults.tenantCode)) {
			tenantCodeArray.push(defaults.tenantCode)
		}

		// Try to get cached data using individual entity values from each org/tenant combination
		let cachedEntities = []
		let hasCachedData = false

		// Get all entity values that might be in the filter
		const entityValues = originalFilter.value && originalFilter.value[Op.in] ? originalFilter.value[Op.in] : [] // If no specific values, we'll skip cache and go to DB

		// Check cache for each org/tenant/entity combination
		for (const tenantCode of tenantCodeArray) {
			for (const orgCode of orgCodeArray) {
				for (const entityValue of entityValues) {
					try {
						const cachedEntity = await cacheHelper.entityTypes.get(
							tenantCode,
							orgCode,
							modelName,
							entityValue
						)

						if (cachedEntity) {
							cachedEntities.push(cachedEntity)
							hasCachedData = true
						}
					} catch (cacheError) {}
				}
			}
		}

		// If we found cached data and it covers all requested entity values, apply original filter logic and return
		if (hasCachedData && entityValues.length > 0) {
			// Apply original filter conditions to cached data
			const filteredData = cachedEntities.filter((entityType) => {
				// Apply all original filter conditions
				for (const [key, value] of Object.entries(originalFilter)) {
					if (key === 'organization_code' || key === 'tenant_code') {
						// Skip tenant/org filtering as cache is already scoped
						continue
					}
					if (key === 'model_names' && value[Op.contains]) {
						const requiredModels = value[Op.contains]
						const entityModels = entityType.model_names || []
						const hasRequiredModel = requiredModels.some((reqModel) => entityModels.includes(reqModel))
						if (!hasRequiredModel) {
							return false
						}
					} else if (key === 'value' && value[Op.in]) {
						if (!value[Op.in].includes(entityType.value)) {
							return false
						}
					} else if (Array.isArray(value)) {
						if (!value.includes(entityType[key])) {
							return false
						}
					} else {
						if (entityType[key] !== value) {
							return false
						}
					}
				}
				return true
			})

			return filteredData
		}

		// Cache miss or partial cache - fetch from database
		const dbResult = await entityTypeQueries.findUserEntityTypesAndEntities(originalFilter, tenantCodes)

		// Cache individual entities using entity value pattern
		if (dbResult && dbResult.length > 0) {
			for (const entityType of dbResult) {
				try {
					// Cache each entity using the standard pattern: tenant:${tenantCode}:org:${orgCode}:entityTypes:model:${modelName}:${entityValue}
					await cacheHelper.entityTypes.set(
						entityType.tenant_code,
						entityType.organization_code,
						modelName,
						entityType.value,
						entityType
					)
				} catch (cacheSetError) {}
			}
		}

		return dbResult
	} catch (error) {
		return await entityTypeQueries.findUserEntityTypesAndEntities(originalFilter, tenantCodes)
	}
}

/**
 * Get entity types and entities for a specific model with unified caching
 * Uses lazy loading strategy - caches complete model data and filters in-memory
 * @method
 * @name getEntityTypesAndEntitiesForModel
 * @param {String} modelName - model name to filter by
 * @param {String|Array} orgCodes - organization codes
 * @param {String|Array} tenantCodes - tenant codes
 * @param {Object} additionalFilters - additional filter conditions
 * @returns {JSON} - Entity types with entities for the model
 */
async function getEntityTypesAndEntitiesForModel(modelName, orgCodes, tenantCodes, additionalFilters = {}) {
	try {
		const defaults = await getDefaults()
		if (!defaults.orgCode) {
			return responses.failureResponse({
				message: 'DEFAULT_ORG_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
		if (!defaults.tenantCode) {
			return responses.failureResponse({
				message: 'DEFAULT_TENANT_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}

		// Ensure orgCodes and tenantCodes are arrays and include defaults
		const orgCodeArray = Array.isArray(orgCodes) ? orgCodes : [orgCodes]
		const tenantCodeArray = Array.isArray(tenantCodes) ? tenantCodes : [tenantCodes]

		if (!orgCodeArray.includes(defaults.orgCode)) {
			orgCodeArray.push(defaults.orgCode)
		}
		if (!tenantCodeArray.includes(defaults.tenantCode)) {
			tenantCodeArray.push(defaults.tenantCode)
		}

		// Try to get known entity types from cache first for ALL org/tenant combinations
		const knownEntityValues = common.entityTypeModelNames // Common model names
		const cachedEntities = []
		const uncachedEntityValues = []

		try {
			// Check cache for each org/tenant/entity combination
			for (const tenantCode of tenantCodeArray) {
				for (const orgCode of orgCodeArray) {
					for (const entityValue of knownEntityValues) {
						try {
							const cachedEntity = await cacheHelper.entityTypes.get(
								tenantCode,
								orgCode,
								modelName,
								entityValue
							)

							if (cachedEntity && cachedEntity.entities) {
								cachedEntities.push(cachedEntity)
							} else {
								uncachedEntityValues.push(entityValue)
							}
						} catch (entityFetchError) {
							uncachedEntityValues.push(entityValue)
						}
					}
				}
			}

			// If we found cached entities, use them directly without database validation
			if (cachedEntities.length > 0) {
				// Ensure each cached entity has the correct format (same as database result)
				// Database returns: [{id, value, label, entities: [...], ...}, ...]
				let formattedCachedEntities = cachedEntities.map((cachedEntity) => ({
					...cachedEntity,
					entities: Array.isArray(cachedEntity.entities) ? cachedEntity.entities : [],
				}))

				// Apply additional filters to cached results
				if (additionalFilters && Object.keys(additionalFilters).length > 0) {
					formattedCachedEntities = formattedCachedEntities.filter((entityType) => {
						// Apply each additional filter
						for (const [key, value] of Object.entries(additionalFilters)) {
							if (Array.isArray(value)) {
								// Array value filter
								if (!value.includes(entityType[key])) {
									return false
								}
							} else if (entityType[key] !== value) {
								return false // This entity doesn't match the filter
							}
						}
						return true // All filters match
					})
				}

				return formattedCachedEntities // Returns array format matching database result
			}
		} catch (cacheError) {}

		// Cache miss - fetch from database
		const allEntitiesFilter = {
			status: 'ACTIVE',
			organization_code: { [Op.in]: orgCodeArray },
			model_names: { [Op.contains]: [modelName] },
			// Don't include additionalFilters in database query - we'll filter cached results
		}

		const allEntityTypes = await entityTypeQueries.findUserEntityTypesAndEntities(
			allEntitiesFilter,
			tenantCodeArray
		)

		// Cache individual entities for both value-based and model-based lookups for ALL org/tenant combinations
		try {
			for (const entityType of allEntityTypes) {
				try {
					// Cache this entity under its specific tenant/org combination
					await cacheHelper.entityTypes.set(
						entityType.tenant_code,
						entityType.organization_code,
						modelName,
						entityType.value,
						entityType
					)
				} catch (individualCacheError) {}
			}
		} catch (cacheError) {}

		// Apply additional filters to the cached results
		let filteredEntityTypes = allEntityTypes
		if (additionalFilters && Object.keys(additionalFilters).length > 0) {
			filteredEntityTypes = allEntityTypes.filter((entityType) => {
				// Apply each additional filter
				for (const [key, value] of Object.entries(additionalFilters)) {
					if (Array.isArray(value)) {
						// Array value filter
						if (!value.includes(entityType[key])) {
							return false
						}
					} else if (entityType[key] !== value) {
						return false // This entity doesn't match the filter
					}
				}
				return true // All filters match
			})
		}

		return filteredEntityTypes
	} catch (error) {
		throw error
	}
}

// Cache filter function removed - use direct database queries instead

/**
 * Clear model-level cache when entity types are updated/deleted
 * This should be called whenever entity types change to invalidate model caches
 * @param {String} tenantCode - tenant code
 * @param {String} orgCode - organization code
 * @param {Array} modelNames - array of model names affected
 */
async function clearModelCache(tenantCode, orgCode, modelNames = []) {
	try {
		// Clear all model-level caches for affected models
		for (const modelName of modelNames) {
			// We can't easily clear specific model cache keys since they contain hashed filters
			// So we clear the entire allModels namespace for this tenant/org
			await cacheHelper.entityTypes.delete(tenantCode, orgCode, 'allModels', `*${modelName}*`)
		}
	} catch (error) {}
}

// Removed applyInMemoryFilters - no longer needed with individual entity value caching

/**
 * Get individual entity type by value (uses individual entity value caching)
 * @method
 * @name getEntityTypeByValue
 * @param {String} modelName - model name
 * @param {String} entityValue - entity value to find
 * @param {String} tenantCode - tenant code
 * @param {String} orgCode - org code
 * @param {Array} orgCodeArray - all org codes to include
 * @param {Array} tenantCodeArray - all tenant codes to include
 * @returns {Object|null} - entity type object or null if not found
 */
async function getEntityTypeByValue(modelName, entityValue, tenantCode, orgCode, orgCodeArray, tenantCodeArray) {
	// Use direct cache helper for individual entity value lookup
	try {
		const cachedEntity = await cacheHelper.entityTypes.get(tenantCode, orgCode, modelName, entityValue)
		if (cachedEntity) {
			return cachedEntity
		}
	} catch (cacheError) {}

	// Fallback to database query if not in cache
	const filter = {
		status: 'ACTIVE',
		value: entityValue,
		organization_code: { [Op.in]: orgCodeArray },
		model_names: { [Op.contains]: [modelName] },
	}

	const entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities(filter, tenantCodeArray)
	const found = entityTypes.length > 0 ? entityTypes[0] : null

	if (found) {
		// Cache it for future use
		try {
			await cacheHelper.entityTypes.set(tenantCode, orgCode, modelName, entityValue, found)
		} catch (cacheError) {}
	}

	return found
}

module.exports = {
	getEntityTypesAndEntitiesWithCache,
	getEntityTypesAndEntitiesForModel,
	getEntityTypeByValue,
	clearModelCache,
}
