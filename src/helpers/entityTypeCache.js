// Dependencies
const httpStatusCode = require('@generics/http-status')
const entityTypeQueries = require('../database/queries/entityType')
const { Op } = require('sequelize')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const responses = require('@helpers/responses')
const cacheHelper = require('@generics/cacheHelper')

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

		// Use standard cache helper instead of unified caching
		// This will store individual entity types based on their values
		console.log(`EntityTypes for model '${modelName}' fetching via standard cache pattern`)

		// Fallback to database query with proper individual caching
		return await getEntityTypesAndEntitiesWithFilter(
			{
				status: 'ACTIVE',
				allow_filtering: true,
				organization_code: { [Op.in]: orgCodeArray },
				model_names: { [Op.contains]: [modelName] },
				...additionalFilters,
			},
			tenantCodeArray
		)
	} catch (error) {
		throw error
	}
}

/**
 * Get entity types and entities matching specific filter criteria with unified caching
 * Uses lazy loading strategy - gets complete model data and filters in-memory
 * @method
 * @name getEntityTypesAndEntitiesWithFilter
 * @param {Object} filter - filter conditions
 * @param {String|Array} tenantCodes - tenant codes
 * @returns {JSON} - Entity types with entities matching filter
 */
async function getEntityTypesAndEntitiesWithFilter(filter, tenantCodes) {
	try {
		const defaults = await getDefaults()
		if (!defaults.tenantCode) {
			return responses.failureResponse({
				message: 'DEFAULT_TENANT_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}

		// Ensure tenantCodes is array and include defaults
		const tenantCodeArray = Array.isArray(tenantCodes) ? tenantCodes : [tenantCodes]
		if (!tenantCodeArray.includes(defaults.tenantCode)) {
			tenantCodeArray.push(defaults.tenantCode)
		}

		const primaryTenantCode = tenantCodeArray[0]
		const orgCode = filter.organization_code?.[Op.in]?.[0] || filter.organization_code
		const modelName = filter.model_names?.[Op.contains]?.[0]

		// Try unified cache approach if we have model info
		if (modelName && orgCode) {
			// Get all entity types for the model using unified cache
			const orgCodeArray = Array.isArray(filter.organization_code?.[Op.in])
				? filter.organization_code[Op.in]
				: [orgCode]

			// Use database query with individual caching instead of unified cache
			console.log(`EntityTypes filter query for model '${modelName}' - using database with individual cache`)
			const entityTypesWithEntities = await entityTypeQueries.findUserEntityTypesAndEntities(
				filter,
				tenantCodeArray
			)
			return entityTypesWithEntities
		}

		// Fallback: fetch directly from database without caching
		console.log('EntityTypes filter query without model/org info - skipping cache')
		const entityTypesWithEntities = await entityTypeQueries.findUserEntityTypesAndEntities(filter, tenantCodeArray)

		return entityTypesWithEntities
	} catch (error) {
		throw error
	}
}

// Removed getAllEntityTypesForModel - unified caching replaced with individual entity value caching

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
	getEntityTypesAndEntitiesForModel,
	getEntityTypesAndEntitiesWithFilter,
	getEntityTypeByValue,
}
