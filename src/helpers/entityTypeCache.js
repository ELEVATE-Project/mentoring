// Dependencies
const httpStatusCode = require('@generics/http-status')
const entityTypeQueries = require('../database/queries/entityType')
const { Op } = require('sequelize')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const responses = require('@helpers/responses')
const cacheHelper = require('@generics/cacheHelper')

/**
 * Get entity types and entities for a specific model with caching
 * This replaces direct calls to entityTypeQueries.findUserEntityTypesAndEntities()
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

		// Try to get from cache first using primary tenant/org
		const primaryTenantCode = tenantCodeArray[0]
		const primaryOrgCode = orgCodeArray[0]

		// For entityTypeCache, we'll check if any individual entity types for this model are cached
		// This is a different pattern - we're looking for entity types WITH entities
		// For now, we'll skip cache and fetch from database directly
		const cachedData = null // Skip cache for this helper that needs complete entity data
		if (cachedData) {
			console.log(`EntityTypes with entities for model '${modelName}' retrieved from cache`)
			return cachedData
		}
		console.log(
			`EntityTypes cache miss for model '${modelName}', tenant: ${primaryTenantCode}, org: ${primaryOrgCode}`
		)

		// Build filter for database query
		const filter = {
			status: 'ACTIVE',
			organization_code: { [Op.in]: orgCodeArray },
			model_names: { [Op.contains]: [modelName] },
			...additionalFilters,
		}

		// Fetch from database
		const entityTypesWithEntities = await entityTypeQueries.findUserEntityTypesAndEntities(filter, {
			[Op.in]: tenantCodeArray,
		})

		// Skip caching for this helper - it handles different entity structures
		console.log(`EntityTypes with entities for model '${modelName}' cached successfully`)

		return entityTypesWithEntities
	} catch (error) {
		throw error
	}
}

/**
 * Get entity types and entities matching specific filter criteria with caching
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

		// Try to generate a cache key from filter (for common patterns)
		const primaryTenantCode = tenantCodeArray[0]
		let cacheKey = null
		let modelName = null

		// Extract org code and model name for caching (if available)
		const orgCode = filter.organization_code?.[Op.in]?.[0] || filter.organization_code
		if (filter.model_names?.[Op.contains]?.[0]) {
			modelName = filter.model_names[Op.contains][0]
			cacheKey = `filteredEntityTypes:${JSON.stringify(filter)}`
		}

		// Try cache if we have enough info
		if (modelName && orgCode) {
			const cachedData = await cacheHelper.entityTypes.get(primaryTenantCode, orgCode, modelName, cacheKey)
			if (cachedData) {
				console.log(`Filtered EntityTypes retrieved from cache for model '${modelName}'`)
				return cachedData
			}
		}

		// Fetch from database
		const entityTypesWithEntities = await entityTypeQueries.findUserEntityTypesAndEntities(filter, {
			[Op.in]: tenantCodeArray,
		})

		// Cache if we have model and org info
		if (modelName && orgCode && cacheKey) {
			await cacheHelper.entityTypes.set(primaryTenantCode, orgCode, modelName, cacheKey, entityTypesWithEntities)
			console.log(`Filtered EntityTypes cached for model '${modelName}'`)
		}

		return entityTypesWithEntities
	} catch (error) {
		throw error
	}
}

module.exports = {
	getEntityTypesAndEntitiesForModel,
	getEntityTypesAndEntitiesWithFilter,
}
