// Dependencies
const httpStatusCode = require('@generics/http-status')
const entityTypeQueries = require('../database/queries/entityType')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const { Op } = require('sequelize')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const responses = require('@helpers/responses')
const cacheHelper = require('@generics/cacheHelper')
const common = require('@constants/common')

/**
 * Get entity types and entities with user-centric cache strategy and defaults fallback
 * @method
 * @name getEntityTypesAndEntitiesWithCache
 * @param {Object} originalFilter - complete original database filter
 * @param {String} tenantCode - user tenant code (single value, not array)
 * @param {String} orgCode - user organization code (single value, not array)
 * @param {String} modelName - model name (optional, for cache optimization)
 * @returns {JSON} - Entity types with entities
 */
async function getEntityTypesAndEntitiesWithCache(originalFilter, tenantCode, orgCode, modelName = null) {
	let defaults = null
	try {
		defaults = await getDefaults()
	} catch (error) {
		console.error('Failed to get defaults for getEntityTypesAndEntitiesWithCache:', error.message)
	}
	const orgCodeArray = Array.isArray(orgCode) ? [...orgCode] : [orgCode]
	if (defaults?.orgCode && !orgCodeArray.includes(defaults.orgCode)) {
		orgCodeArray.push(defaults.orgCode)
	}
	const orgFilter = { [Op.in]: orgCodeArray.filter(Boolean) }

	try {
		// No modelName — cache key cannot be built, go straight to DB
		if (!modelName) {
			return (
				(await entityTypeQueries.findUserEntityTypesAndEntities(
					{ ...originalFilter, organization_code: orgFilter },
					tenantCode
				)) || []
			)
		}

		const entityTypeDefs = await entityTypeQueries.findAllEntityTypes(
			orgFilter,
			tenantCode,
			undefined,
			originalFilter
		)

		if (!entityTypeDefs || entityTypeDefs.length === 0) return []
		return resolveEntityTypesWithCache(entityTypeDefs, tenantCode, modelName)
	} catch (error) {
		console.error('Failed to get entity types with cache:', error)
		try {
			return await entityTypeQueries.findUserEntityTypesAndEntities(
				{ ...originalFilter, organization_code: orgFilter },
				tenantCode
			)
		} catch (fallbackError) {
			console.error('Fallback database query also failed:', fallbackError)
			return []
		}
	}
}

/**
 * Get entity types and entities for a specific model with user-centric caching and defaults fallback
 * Uses user-specific tenant/org codes with automatic default fallback
 * @method
 * @name getEntityTypesAndEntitiesForModel
 * @param {String} modelName - model name to filter by
 * @param {String} tenantCode - user tenant code (single value, not array)
 * @param {String|Array} orgCode - user organization code(s); single string or array — default org is always appended internally
 * @param {Object} additionalFilters - additional filter conditions
 * @returns {JSON} - Entity types with entities for the model
 */
async function getEntityTypesAndEntitiesForModel(modelName, tenantCode, orgCode, additionalFilters = {}) {
	try {
		// Get defaults internally for database query
		let defaults = null
		try {
			defaults = await getDefaults()
		} catch (error) {
			console.error('Failed to get defaults for getEntityTypesAndEntitiesForModel:', error.message)
		}

		if (!defaults || !defaults.orgCode) {
			return responses.failureResponse({
				message: 'DEFAULT_ORG_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}

		// Normalize orgCode: accept array or single string, always include default org
		const orgCodeArray = Array.isArray(orgCode) ? [...orgCode] : [orgCode]
		if (!orgCodeArray.includes(defaults.orgCode)) orgCodeArray.push(defaults.orgCode)
		const cleanOrgCodes = orgCodeArray.filter(Boolean)

		const typeFilter = {
			status: 'ACTIVE',
			model_names: { [Op.contains]: [modelName] },
			...additionalFilters,
		}
		const entityTypes = await entityTypeQueries.findAllEntityTypes(
			{ [Op.in]: cleanOrgCodes },
			tenantCode,
			undefined,
			typeFilter
		)

		if (!entityTypes || entityTypes.length === 0) return []
		return resolveEntityTypesWithCache(entityTypes, tenantCode, modelName)
	} catch (error) {
		console.error(`Failed to get entity types for model ${modelName}:`, error)
		return []
	}
}

/**
 * Shared Steps 2+3: check cache per entity type, fetch entities only for misses.
 * Used by getEntityTypesAndEntitiesForModel and getEntityTypesAndEntitiesWithCache.
 * @param {Array} entityTypeDefs - entity type rows from Step 1 (no entities join)
 * @param {string} tenantCode
 * @param {string} modelName
 * @returns {Promise<Array>} entity types with entities
 */
async function resolveEntityTypesWithCache(entityTypeDefs, tenantCode, modelName) {
	const results = []
	const cacheMisses = []

	for (const entityTypeDef of entityTypeDefs) {
		try {
			const cached = await cacheHelper.entityTypes.getCacheOnly(
				tenantCode,
				entityTypeDef.organization_code,
				modelName,
				entityTypeDef.value
			)
			if (cached && !Array.isArray(cached)) {
				results.push(cached)
			} else {
				cacheMisses.push(entityTypeDef)
			}
		} catch (cacheError) {
			cacheMisses.push(entityTypeDef)
		}
	}

	if (cacheMisses.length > 0) {
		const missedIds = cacheMisses.map((e) => e.id)
		let missedWithEntities = []
		try {
			missedWithEntities = await entityTypeQueries.findUserEntityTypesAndEntities(
				{ id: { [Op.in]: missedIds } },
				tenantCode
			)
		} catch (dbError) {
			console.error('Failed to fetch entity types from database:', dbError.message)
			return results
		}
		for (const entityTypeWithEntities of missedWithEntities) {
			try {
				await cacheHelper.entityTypes.set(
					tenantCode,
					entityTypeWithEntities.organization_code,
					modelName,
					entityTypeWithEntities.value,
					entityTypeWithEntities
				)
			} catch (cacheSetError) {
				// silent — cache write failure must not block the response
			}
			results.push(entityTypeWithEntities)
		}
	}

	return results
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
 * Get individual entity type by value with user-centric caching and defaults fallback
 * @method
 * @name getEntityTypeByValue
 * @param {String} modelName - model name
 * @param {String} entityValue - entity value to find
 * @param {String} tenantCode - user tenant code
 * @param {String} orgCode - user org code
 * @returns {Object|null} - entity type object or null if not found
 */
async function getEntityTypeByValue(modelName, entityValue, tenantCode, orgCode) {
	// Use direct cache helper for individual entity value lookup
	try {
		const cachedEntity = await cacheHelper.entityTypes.get(tenantCode, orgCode, modelName, entityValue)
		if (cachedEntity) {
			return cachedEntity
		}
	} catch (cacheError) {}

	// Get defaults internally for database query
	let defaults = null
	try {
		defaults = await getDefaults()
	} catch (error) {
		console.error('Failed to get defaults for getEntityTypeByValue:', error.message)
	}

	// Fallback to database query if not in cache
	let found = null
	try {
		// First try with user tenant and org codes
		const userFilter = {
			status: 'ACTIVE',
			value: entityValue,
			organization_code: orgCode,
			model_names: { [Op.contains]: [modelName] },
		}
		let entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities(userFilter, tenantCode)
		found = entityTypes.length > 0 ? entityTypes[0] : null
	} catch (dbError) {
		console.error(`Failed to fetch entity type ${modelName}:${entityValue} from database:`, dbError.message)
		return null
	}

	// Cache it under user context (regardless of where it was found)
	if (found) {
		try {
			await cacheHelper.entityTypes.set(tenantCode, orgCode, modelName, entityValue, found)
		} catch (cacheError) {}
	}

	return found
}

/**
 * Resolve entity types for a model, using the mentor's org code when available.
 * Delegates to getEntityTypesAndEntitiesForModel after resolving the effective org.
 * @param {string} tenantCode
 * @param {string} currentOrgCode - caller's org code (fallback if mentor org not found)
 * @param {string} mentorOrganizationId - numeric org ID of the mentor (may be null)
 * @param {string} modelName
 */
async function getEntityTypesWithMentorOrg(tenantCode, currentOrgCode, mentorOrganizationId, modelName) {
	try {
		let mentorOrgCode = null
		if (mentorOrganizationId) {
			try {
				const mentorOrg = await cacheHelper.organizations.get(tenantCode, currentOrgCode, mentorOrganizationId)
				mentorOrgCode = mentorOrg?.organization_code
			} catch (orgCacheError) {
				console.warn('Organization cache lookup failed, falling back to database query')
				const orgData = await organisationExtensionQueries.findOne(
					{ organization_id: mentorOrganizationId },
					tenantCode,
					{ attributes: ['organization_code'], raw: true }
				)
				mentorOrgCode = orgData?.organization_code
			}
		}

		const effectiveOrgCode = mentorOrgCode || currentOrgCode
		return getEntityTypesAndEntitiesForModel(modelName, tenantCode, effectiveOrgCode)
	} catch (error) {
		console.error('Failed to get entity types with mentor org resolution:', error)
		return []
	}
}

module.exports = {
	getEntityTypesAndEntitiesWithCache,
	getEntityTypesAndEntitiesForModel,
	getEntityTypeByValue,
	getEntityTypesWithMentorOrg,
	clearModelCache,
}
