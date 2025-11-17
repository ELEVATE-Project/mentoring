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
			console.log('No modelName provided for cache optimization - using direct database query')
			return await entityTypeQueries.findUserEntityTypesAndEntities(originalFilter, tenantCodes)
		}

		// Extract core filter components for cache key
		const orgCodes = Array.isArray(originalFilter.organization_code?.[Op.in])
			? originalFilter.organization_code[Op.in]
			: [originalFilter.organization_code]

		if (!orgCodes || orgCodes.length === 0) {
			console.log('No organization codes found - using direct database query')
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

		const primaryTenantCode = tenantCodeArray[0]
		const primaryOrgCode = orgCodeArray[0]

		console.log(`Trying cache for model '${modelName}' with fallback to original filter`)

		// Try cache first - check for cached entities
		try {
			const cacheKey = `model:${modelName}:all`
			const cachedModelData = await cacheHelper.entityTypes.get(primaryTenantCode, primaryOrgCode, cacheKey)

			if (cachedModelData && Array.isArray(cachedModelData) && cachedModelData.length > 0) {
				console.log(`Found cached data for model '${modelName}' with ${cachedModelData.length} entities`)

				// Apply original filters to cached data
				const filteredData = cachedModelData.filter((entityType) => {
					// Apply all original filter conditions
					for (const [key, value] of Object.entries(originalFilter)) {
						if (key === 'organization_code' || key === 'tenant_code') {
							// Skip tenant/org filtering as cache is already scoped
							continue
						}
						if (key === 'model_names' && value[Op.contains]) {
							// Check if entity's model_names contains the required model
							const requiredModels = value[Op.contains]
							const entityModels = entityType.model_names || []
							const hasRequiredModel = requiredModels.some((reqModel) => entityModels.includes(reqModel))
							if (!hasRequiredModel) {
								return false
							}
						} else if (key === 'value' && value[Op.in]) {
							// Check if entity value is in the required values
							if (!value[Op.in].includes(entityType.value)) {
								return false
							}
						} else if (Array.isArray(value)) {
							// Array value filter (like entityType filter)
							if (!value.includes(entityType[key])) {
								return false
							}
						} else {
							// Direct property match
							if (entityType[key] !== value) {
								return false
							}
						}
					}
					return true
				})

				console.log(
					`Cache hit: filtered ${cachedModelData.length} cached entities down to ${filteredData.length} matching original filter`
				)
				return filteredData
			}
		} catch (cacheError) {
			console.log(`Cache lookup failed for model '${modelName}':`, cacheError.message)
		}

		// Cache miss - fallback to original database query
		console.log(`Cache miss for model '${modelName}' - falling back to original database query`)
		const dbResult = await entityTypeQueries.findUserEntityTypesAndEntities(originalFilter, tenantCodes)

		// Cache the result for future use (cache core model data only)
		try {
			if (dbResult && dbResult.length > 0) {
				// Cache all entities for this model (not just the filtered subset)
				const coreFilter = {
					status: 'ACTIVE',
					organization_code: { [Op.in]: orgCodeArray },
					model_names: { [Op.contains]: [modelName] },
				}

				const allModelEntities = await entityTypeQueries.findUserEntityTypesAndEntities(
					coreFilter,
					tenantCodeArray
				)

				const cacheKey = `model:${modelName}:all`
				await cacheHelper.entityTypes.set(primaryTenantCode, primaryOrgCode, cacheKey, allModelEntities)
				console.log(`Cached ${allModelEntities.length} entities for model '${modelName}' for future use`)
			}
		} catch (cacheSetError) {
			console.log(`Failed to cache model data for '${modelName}':`, cacheSetError.message)
		}

		return dbResult
	} catch (error) {
		console.log('Cache function error - falling back to direct database query:', error.message)
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

		const primaryTenantCode = tenantCodeArray[0]
		const primaryOrgCode = orgCodeArray[0]

		console.log(`EntityTypes for model '${modelName}' fetching with cache support`)

		// Try to get known entity types from cache first
		// We'll check for common entity values that are likely to be cached
		const knownEntityValues = common.entityTypeModelNames // Common model names
		const cachedEntities = []
		const uncachedEntityValues = []

		try {
			console.log(`Checking cache for model '${modelName}' with known entity values`)

			// Check cache for each known entity value
			for (const entityValue of knownEntityValues) {
				try {
					const cachedEntity = await cacheHelper.entityTypes.get(
						primaryTenantCode,
						primaryOrgCode,
						modelName,
						entityValue
					)

					if (cachedEntity && cachedEntity.entities) {
						cachedEntities.push(cachedEntity)
						console.log(`Found cached entity '${entityValue}' for model '${modelName}'`)
					} else {
						uncachedEntityValues.push(entityValue)
					}
				} catch (entityFetchError) {
					uncachedEntityValues.push(entityValue)
				}
			}

			// If we found some cached entities, we can try to use them
			// But we need to validate against database to ensure completeness
			if (cachedEntities.length > 0) {
				console.log(`Found ${cachedEntities.length} cached entities for model '${modelName}'`)

				// Quick check: get entity values from database to compare
				const dbEntityValues = await entityTypeQueries.findAllEntityTypes(
					{ [Op.in]: orgCodeArray },
					{ [Op.in]: tenantCodeArray },
					['value'], // Only get values for comparison
					{
						status: 'ACTIVE',
						model_names: { [Op.contains]: [modelName] },
						...additionalFilters,
					}
				)

				const dbValues = new Set(dbEntityValues.map((e) => e.value))
				const cachedValues = new Set(cachedEntities.map((e) => e.value))

				// Check if our cache covers all database values
				const allValuesCached = [...dbValues].every((value) => cachedValues.has(value))

				if (allValuesCached && cachedEntities.length === dbEntityValues.length) {
					console.log(`Cache complete for model '${modelName}' - returning cached data as array`)

					// Ensure each cached entity has the correct format (same as database result)
					// Database returns: [{id, value, label, entities: [...], ...}, ...]
					let formattedCachedEntities = cachedEntities.map((cachedEntity) => ({
						...cachedEntity,
						entities: Array.isArray(cachedEntity.entities) ? cachedEntity.entities : [],
					}))

					// Apply additional filters to cached results
					if (additionalFilters && Object.keys(additionalFilters).length > 0) {
						console.log(
							`Applying additional filters to complete cached model '${modelName}' data:`,
							additionalFilters
						)

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

						console.log(
							`Filtered ${cachedEntities.length} cached entities down to ${formattedCachedEntities.length} matching additional filters`
						)
					}

					return formattedCachedEntities // Returns array format matching database result
				} else {
					console.log(`Cache incomplete for model '${modelName}' - fetching from database`)
				}
			}
		} catch (cacheError) {
			console.log(`Cache checking failed for model '${modelName}':`, cacheError.message)
		}

		// Cache miss - fetch from database
		const allEntitiesFilter = {
			status: 'ACTIVE',
			organization_code: { [Op.in]: orgCodeArray },
			model_names: { [Op.contains]: [modelName] },
			// Don't include additionalFilters in database query - we'll filter cached results
		}

		console.log(`Fetching all entity types for model '${modelName}' from database`)
		const allEntityTypes = await entityTypeQueries.findUserEntityTypesAndEntities(
			allEntitiesFilter,
			tenantCodeArray
		)

		// Cache individual entities for both value-based and model-based lookups
		try {
			console.log(`Caching ${allEntityTypes.length} individual entities for model '${modelName}'`)

			for (const entityType of allEntityTypes) {
				try {
					await cacheHelper.entityTypes.set(
						primaryTenantCode,
						primaryOrgCode,
						modelName,
						entityType.value,
						entityType
					)
				} catch (individualCacheError) {
					console.log(`Failed to cache individual entity ${entityType.value}:`, individualCacheError.message)
				}
			}
		} catch (cacheError) {
			console.log(`Failed to cache entities for model '${modelName}':`, cacheError.message)
		}

		// Apply additional filters to the cached results
		let filteredEntityTypes = allEntityTypes
		if (additionalFilters && Object.keys(additionalFilters).length > 0) {
			console.log(`Applying additional filters to cached model '${modelName}' data:`, additionalFilters)

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

			console.log(
				`Filtered ${allEntityTypes.length} cached entities down to ${filteredEntityTypes.length} matching additional filters`
			)
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
		console.log(`Cleared model-level cache for models: ${modelNames.join(', ')}`)
	} catch (error) {
		console.log('Failed to clear model cache:', error.message)
	}
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
			console.log(`EntityType '${entityValue}' for model '${modelName}' found in individual cache`)
			return cachedEntity
		}
	} catch (cacheError) {
		console.log(`Cache lookup failed for entity ${entityValue}, falling back to database`)
	}

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
		console.log(`EntityType '${entityValue}' for model '${modelName}' found in database`)
		// Cache it for future use
		try {
			await cacheHelper.entityTypes.set(tenantCode, orgCode, modelName, entityValue, found)
		} catch (cacheError) {
			console.log(`Failed to cache entity ${entityValue}:`, cacheError.message)
		}
	}

	return found
}

module.exports = {
	getEntityTypesAndEntitiesWithCache,
	getEntityTypesAndEntitiesForModel,
	getEntityTypeByValue,
	clearModelCache,
}
