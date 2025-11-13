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

		// Get all entity types for the model using unified cache strategy
		const allEntityTypes = await getAllEntityTypesForModel(
			modelName,
			primaryTenantCode,
			primaryOrgCode,
			orgCodeArray,
			tenantCodeArray
		)

		// Apply additional filters in-memory if specified
		if (Object.keys(additionalFilters).length > 0) {
			return applyInMemoryFilters(allEntityTypes, additionalFilters)
		}

		console.log(`EntityTypes for model '${modelName}' retrieved from unified cache`)
		return allEntityTypes
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

			const allEntityTypes = await getAllEntityTypesForModel(
				modelName,
				primaryTenantCode,
				orgCode,
				orgCodeArray,
				tenantCodeArray
			)

			// Apply filters in-memory (much faster than separate cache)
			const filtered = applyInMemoryFilters(allEntityTypes, filter)
			console.log(`Filtered EntityTypes for model '${modelName}' retrieved from unified cache`)
			return filtered
		}

		// Fallback: fetch directly from database without caching
		console.log('EntityTypes filter query without model/org info - skipping cache')
		const entityTypesWithEntities = await entityTypeQueries.findUserEntityTypesAndEntities(filter, tenantCodeArray)

		return entityTypesWithEntities
	} catch (error) {
		throw error
	}
}

/**
 * Unified cache strategy: Get all entity types for a model (single cache per model)
 * @method
 * @name getAllEntityTypesForModel
 * @param {String} modelName - model name
 * @param {String} tenantCode - primary tenant code
 * @param {String} orgCode - primary org code
 * @param {Array} orgCodeArray - all org codes to include
 * @param {Array} tenantCodeArray - all tenant codes to include
 * @returns {Array} - All entity types with entities for the model
 */
async function getAllEntityTypesForModel(modelName, tenantCode, orgCode, orgCodeArray, tenantCodeArray) {
	return await cacheHelper.getOrSet({
		tenantCode,
		orgCode,
		ns: 'entityTypes',
		id: `model:${modelName}:__ALL__`,
		ttl: 86400, // 1 day TTL
		fetchFn: async () => {
			console.log(`EntityTypes cache miss for model '${modelName}', fetching complete dataset from DB`)

			// Build filter for complete model data
			const filter = {
				status: 'ACTIVE',
				allow_filtering: true,
				organization_code: { [Op.in]: orgCodeArray },
				model_names: { [Op.contains]: [modelName] },
				...additionalFilters,
			}

			// Fetch complete dataset from database
			const allEntityTypes = await entityTypeQueries.findUserEntityTypesAndEntities(filter, tenantCodeArray)

			console.log(`Cached complete EntityTypes dataset for model '${modelName}' (${allEntityTypes.length} items)`)
			return allEntityTypes
		},
	})
}

/**
 * Apply additional filters to entity types in-memory
 * @method
 * @name applyInMemoryFilters
 * @param {Array} entityTypes - array of entity types to filter
 * @param {Object} filters - filter conditions to apply
 * @returns {Array} - filtered entity types
 */
function applyInMemoryFilters(entityTypes, filters) {
	if (!entityTypes || !Array.isArray(entityTypes)) {
		return []
	}

	return entityTypes.filter((entityType) => {
		// Apply each filter condition
		for (const [key, value] of Object.entries(filters)) {
			// Skip standard query fields that are already applied at cache level
			if (['status', 'organization_code', 'model_names'].includes(key)) {
				continue
			}

			// Handle Sequelize operators
			if (value && typeof value === 'object' && value[Op.in]) {
				if (!value[Op.in].includes(entityType[key])) {
					return false
				}
			} else if (value && typeof value === 'object' && value[Op.contains]) {
				if (!entityType[key] || !entityType[key].some((item) => value[Op.contains].includes(item))) {
					return false
				}
			} else if (value && typeof value === 'object' && value[Op.like]) {
				const likeValue = value[Op.like].replace(/%/g, '')
				if (!entityType[key] || !entityType[key].toLowerCase().includes(likeValue.toLowerCase())) {
					return false
				}
			} else {
				// Direct comparison
				if (entityType[key] !== value) {
					return false
				}
			}
		}
		return true
	})
}

/**
 * Get individual entity type by value (uses unified cache)
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
	const allEntityTypes = await getAllEntityTypesForModel(
		modelName,
		tenantCode,
		orgCode,
		orgCodeArray,
		tenantCodeArray
	)
	const found = allEntityTypes.find((entityType) => entityType.value === entityValue)

	if (found) {
		console.log(`EntityType '${entityValue}' for model '${modelName}' found in unified cache`)
	}

	return found || null
}

module.exports = {
	getEntityTypesAndEntitiesForModel,
	getEntityTypesAndEntitiesWithFilter,
	getEntityTypeByValue,
}
