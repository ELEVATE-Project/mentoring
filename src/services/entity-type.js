// Dependencies
const httpStatusCode = require('@generics/http-status')
const entityTypeQueries = require('../database/queries/entityType')
const { UniqueConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const { removeDefaultOrgEntityTypes } = require('@generics/utils')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const utils = require('@generics/utils')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const cacheHelper = require('@generics/cacheHelper')
const cacheService = require('@helpers/cache')

module.exports = class EntityHelper {
	/**
	 * Create entity type.
	 * @method
	 * @name create
	 * @param {Object} bodyData - entity type body data.
	 * @param {String} id -  id.
	 * @returns {JSON} - Created entity type response.
	 */

	static async create(bodyData, id, orgId, orgCode, tenantCode, roles) {
		bodyData.created_by = id
		bodyData.updated_by = id
		bodyData.organization_id = orgId
		bodyData.organization_code = orgCode
		bodyData.tenant_code = tenantCode
		bodyData.value = bodyData.value.toLowerCase()
		try {
			if (bodyData.allow_filtering) {
				const isAdmin =
					roles && Array.isArray(roles) ? roles.some((role) => role.title === common.ADMIN_ROLE) : false
				bodyData.allow_filtering = isAdmin ? bodyData.allow_filtering : false
			}

			const entityType = await entityTypeQueries.createEntityType(bodyData, tenantCode)

			// Invalidate entity-type related caches after successful creation
			await this._invalidateEntityTypeCaches({ tenantCode, orgCode })

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ENTITY_TYPE_CREATED_SUCCESSFULLY',
				result: entityType,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Update entity type.
	 * @method
	 * @name update
	 * @param {Object} bodyData -  body data.
	 * @param {String} id - entity type id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @returns {JSON} - Updated Entity Type.
	 */

	static async update(bodyData, id, loggedInUserId, orgCode, tenantCode, roles) {
		bodyData.updated_by = loggedInUserId
		if (bodyData.value) {
			bodyData.value = bodyData.value.toLowerCase()
		}

		try {
			if (bodyData.allow_filtering) {
				const isAdmin =
					roles && Array.isArray(roles) ? roles.some((role) => role.title === common.ADMIN_ROLE) : false
				bodyData.allow_filtering = isAdmin ? bodyData.allow_filtering : false
			}
			const [updateCount, updatedEntityType] = await entityTypeQueries.updateOneEntityType(
				id,
				orgCode,
				tenantCode,
				bodyData,
				{
					returning: true,
					raw: true,
				}
			)

			if (updateCount === 0) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Invalidate entity-type related caches after successful update
			await this._invalidateEntityTypeCaches({ tenantCode, orgCode })

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ENTITY_TYPE_UPDATED_SUCCESSFULLY',
				result: updatedEntityType,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	static async readAllSystemEntityTypes(orgCode, tenantCode) {
		try {
			const attributes = ['value', 'label', 'id']
			const defaults = await getDefaults()
			if (!defaults.orgCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			let entities
			try {
				entities = await cacheHelper.getOrSet({
					tenantCode,
					orgCode: orgCode,
					ns: common.CACHE_CONFIG.namespaces.entity_types.name,
					id: 'system_all',
					fetchFn: async () => {
						const defaults = await getDefaults()
						const attributes = ['value', 'label', 'id']
						return await entityTypeQueries.findAllEntityTypes(
							{ [Op.or]: [orgCode, defaults.orgCode] },
							{ [Op.in]: [tenantCode, defaults.tenantCode] },
							attributes
						)
					},
				})
			} catch (cacheError) {
				console.warn('Cache system failed for entity types, falling back to database:', cacheError.message)
				const defaults = await getDefaults()
				const attributes = ['value', 'label', 'id']
				entities = await entityTypeQueries.findAllEntityTypes(
					{ [Op.or]: [orgCode, defaults.orgCode] },
					{ [Op.in]: [tenantCode, defaults.tenantCode] },
					attributes
				)
			}

			if (!entities.length) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_TYPE_FETCHED_SUCCESSFULLY',
				result: entities,
			})
		} catch (error) {
			throw error
		}
	}

	static async readUserEntityTypes(body, orgCode, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			const filter = {
				value: body.value,
				status: 'ACTIVE',
				organization_code: {
					[Op.in]: [orgCode, defaults.orgCode],
				},
				tenant_code: { [Op.in]: [defaults.tenantCode, tenantCode] },
			}
			let entityTypes
			// Create tenant and org based cache key for entity types
			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:${common.CACHE_CONFIG.namespaces.entity_types.name}:user_entities`

			try {
				// Use direct Redis operations without tenant/org codes
				const cached = await cacheHelper.get(cacheKey)
				if (cached !== null && cached !== undefined) {
					entityTypes = cached
				} else {
					const dbResult = await entityTypeQueries.findUserEntityTypesAndEntities(filter, {
						[Op.in]: [defaults.tenantCode, tenantCode],
					})

					// Ensure model_names arrays are properly maintained
					if (dbResult && Array.isArray(dbResult)) {
						dbResult.forEach((entityType) => {
							if (entityType.model_names && !Array.isArray(entityType.model_names)) {
								// Fix corrupted model_names - convert object back to array
								if (typeof entityType.model_names === 'object' && entityType.model_names !== null) {
									entityType.model_names = Object.values(entityType.model_names).filter(Boolean)
								} else {
									entityType.model_names = []
								}
							}
						})
					}

					entityTypes = dbResult
					if (entityTypes !== undefined) {
						const ttl = common.CACHE_CONFIG.namespaces.entity_types.defaultTtl || 0
						await cacheHelper.set(cacheKey, entityTypes, ttl || undefined)
					}
				}

				// Fix model_names arrays if they got corrupted in cache
				if (entityTypes && Array.isArray(entityTypes)) {
					entityTypes.forEach((entityType) => {
						if (entityType.model_names && !Array.isArray(entityType.model_names)) {
							// Fix corrupted model_names - convert object back to array
							if (typeof entityType.model_names === 'object' && entityType.model_names !== null) {
								entityType.model_names = Object.values(entityType.model_names).filter(Boolean)
							} else {
								entityType.model_names = []
							}
						}
					})
				}
			} catch (cacheError) {
				console.warn('Cache system failed for user entity types, falling back to database:', cacheError.message)
				entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities(filter, {
					[Op.in]: [defaults.tenantCode, tenantCode],
				})
			}

			const prunedEntities = removeDefaultOrgEntityTypes(entityTypes, defaults.orgCode)

			if (prunedEntities.length == 0) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_TYPE_FETCHED_SUCCESSFULLY',
				result: { entity_types: prunedEntities },
			})
		} catch (error) {
			throw error
		}
	}
	/**
	 * Delete entity type.
	 * @method
	 * @name delete
	 * @param {String} id - Delete entity type.
	 * @returns {JSON} - Entity deleted response.
	 */

	static async delete(id, organizationCode, tenantCode) {
		try {
			const deleteCount = await entityTypeQueries.deleteOneEntityType(id, organizationCode, tenantCode)
			if (deleteCount === 0) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ENTITY_TYPE_DELETED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * @description 							- process data to add value and labels in case of entity type
	 * @method
	 * @name processEntityTypesToAddValueLabels
	 * @param {Array} responseData 				- data to modify
	 * @param {Array} orgCods					- org ids
	 * @param {String} modelName 				- model name which the entity search is associated to.
	 * @param {String} orgCodeKey 				- In responseData which key represents org id
	 * @param {ARRAY} entityType 				- Array of entity types value
	 * @returns {JSON} 							- modified response data
	 */
	static async processEntityTypesToAddValueLabels(
		responseData,
		orgCodes,
		modelName,
		orgCodeKey,
		entityType,
		tenantCodes = []
	) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			if (!orgCodes.includes(defaults.orgCode)) {
				orgCodes.push(defaults.orgCode)
			}

			if (!tenantCodes.includes(defaults.tenantCode)) {
				tenantCodes.push(defaults.tenantCode)
			}

			const filter = {
				status: 'ACTIVE',
				has_entities: true,
				organization_code: {
					[Op.in]: orgCodes,
				},
				model_names: {
					[Op.contains]: Array.isArray(modelName) ? modelName : [modelName],
				},
				tenant_code: {
					[Op.in]: tenantCodes,
				},
			}
			if (entityType) filter.value = entityType
			// get entityTypes with entities data
			let entityTypesWithEntities = await entityTypeQueries.findUserEntityTypesAndEntities(filter, tenantCodes)
			entityTypesWithEntities = JSON.parse(JSON.stringify(entityTypesWithEntities))
			if (!entityTypesWithEntities.length > 0) {
				return responseData
			}

			// Use Array.map with async to process each element asynchronously
			const result = responseData.map(async (element) => {
				// Prepare the array of orgCodes to search
				const orgIdToSearch = [element[orgCodeKey], defaults.orgCode]

				// Filter entity types based on orgCodes and remove parent entity types
				let entitTypeData = entityTypesWithEntities.filter((obj) =>
					orgIdToSearch.includes(obj.organization_code)
				)
				entitTypeData = utils.removeParentEntityTypes(entitTypeData)

				// Process the data asynchronously to add value labels
				const processDbResponse = await utils.processDbResponse(element, entitTypeData)

				// Return the processed result
				return processDbResponse
			})
			return Promise.all(result)
		} catch (err) {
			return err
		}
	}

	/**
	 * Read user entity types and entities with caching and fallback
	 * @method
	 * @name readUserEntityTypesAndEntitiesCached
	 * @param {Object} filter - Filter criteria for entity types
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Array} - Cached entity types with entities
	 */
	static async readUserEntityTypesAndEntitiesCached(filter, orgCode, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode || !defaults.tenantCode) {
				throw new Error('DEFAULT_ORG_CODE_OR_TENANT_CODE_NOT_SET')
			}

			// Create tenant and org based cache key with model separation
			const modelNames =
				filter.model_names?.[Op.contains] || filter.model_names?.[Op.overlap] || filter.model_names || []
			const modelName = Array.isArray(modelNames) ? modelNames[0] : modelNames || 'all'
			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:${common.CACHE_CONFIG.namespaces.entity_types.name}:${modelName}`
			console.log('🔍 [ENTITY CACHE DEBUG] Looking for cache key:', cacheKey)
			console.log('🔍 [ENTITY CACHE DEBUG] Filter:', JSON.stringify(filter, null, 2))
			console.log('🔍 [ENTITY CACHE DEBUG] Extracted model name:', modelName)

			let entityTypesWithEntities
			try {
				// Use direct Redis operations without tenant/org codes
				const cached = await cacheHelper.get(cacheKey)
				console.log('🔍 [ENTITY CACHE DEBUG] Cache result:', cached ? 'FOUND' : 'NOT FOUND')
				if (cached !== null && cached !== undefined) {
					entityTypesWithEntities = cached
					console.log('🔍 [ENTITY CACHE DEBUG] Using cached data, count:', entityTypesWithEntities?.length)
				} else {
					// Merge tenant codes including defaults for fallback
					const tenantCodes = { [Op.in]: [defaults.tenantCode, tenantCode] }
					const dbResult = await entityTypeQueries.findUserEntityTypesAndEntities(filter, tenantCodes)
					console.log('🔍 [ENTITY CACHE DEBUG] DB result count:', dbResult?.length)
					console.log('🔍 [ENTITY CACHE DEBUG] DB result sample model_names:', dbResult?.[0]?.model_names)

					// Ensure model_names arrays are properly maintained
					if (dbResult && Array.isArray(dbResult)) {
						dbResult.forEach((entityType) => {
							if (entityType.model_names && !Array.isArray(entityType.model_names)) {
								// Fix corrupted model_names - convert object back to array
								if (typeof entityType.model_names === 'object' && entityType.model_names !== null) {
									entityType.model_names = Object.values(entityType.model_names).filter(Boolean)
								} else {
									entityType.model_names = []
								}
							}
						})
					}

					entityTypesWithEntities = dbResult
					if (entityTypesWithEntities !== undefined) {
						const ttl = common.CACHE_CONFIG.namespaces.entity_types.defaultTtl || 0
						await cacheHelper.set(cacheKey, entityTypesWithEntities, ttl || undefined)
						console.log('🔍 [ENTITY CACHE DEBUG] Saved to cache with key:', cacheKey)
					}
				}

				// Fix model_names arrays if they got corrupted in cache
				if (entityTypesWithEntities && Array.isArray(entityTypesWithEntities)) {
					entityTypesWithEntities.forEach((entityType) => {
						if (entityType.model_names && !Array.isArray(entityType.model_names)) {
							// Fix corrupted model_names - convert object back to array
							if (typeof entityType.model_names === 'object' && entityType.model_names !== null) {
								entityType.model_names = Object.values(entityType.model_names).filter(Boolean)
							} else {
								entityType.model_names = []
							}
						}
					})
				}
			} catch (cacheError) {
				console.warn(
					'Cache system failed for user entity types with entities, falling back to database:',
					cacheError.message
				)
				const tenantCodes = { [Op.in]: [defaults.tenantCode, tenantCode] }
				entityTypesWithEntities = await entityTypeQueries.findUserEntityTypesAndEntities(filter, tenantCodes)
			}

			return entityTypesWithEntities
		} catch (error) {
			throw error
		}
	}

	/**
	 * Read all entity types with caching and fallback
	 * @method
	 * @name readAllEntityTypesCached
	 * @param {Array|Object} orgCodes - Organization codes
	 * @param {Array|Object} tenantCodes - Tenant codes
	 * @param {Array} attributes - Attributes to select
	 * @param {Object} filter - Additional filter criteria
	 * @returns {Array} - Cached entity types
	 */
	static async readAllEntityTypesCached(orgCodes, tenantCodes, attributes, filter = {}) {
		try {
			// Create tenant and org based cache key for all entity types
			const tenantCode = Array.isArray(tenantCodes) ? tenantCodes[0] : tenantCodes
			const orgCode = Array.isArray(orgCodes) ? orgCodes[0] : orgCodes
			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:${common.CACHE_CONFIG.namespaces.entity_types.name}:all_types`

			let entityTypes
			try {
				// Use direct Redis operations with tenant/org structure
				const cached = await cacheHelper.get(cacheKey)
				if (cached !== null && cached !== undefined) {
					entityTypes = cached
				} else {
					const dbResult = await entityTypeQueries.findAllEntityTypes(
						orgCodes,
						tenantCodes,
						attributes,
						filter
					)

					// Ensure model_names arrays are properly maintained
					if (dbResult && Array.isArray(dbResult)) {
						dbResult.forEach((entityType) => {
							if (entityType.model_names && !Array.isArray(entityType.model_names)) {
								// Fix corrupted model_names - convert object back to array
								if (typeof entityType.model_names === 'object' && entityType.model_names !== null) {
									entityType.model_names = Object.values(entityType.model_names).filter(Boolean)
								} else {
									entityType.model_names = []
								}
							}
						})
					}

					entityTypes = dbResult
					if (entityTypes !== undefined) {
						const ttl = common.CACHE_CONFIG.namespaces.entity_types.defaultTtl || 0
						await cacheHelper.set(cacheKey, entityTypes, ttl || undefined)
					}
				}

				// Fix model_names arrays if they got corrupted in cache
				if (entityTypes && Array.isArray(entityTypes)) {
					entityTypes.forEach((entityType) => {
						if (entityType.model_names && !Array.isArray(entityType.model_names)) {
							// Fix corrupted model_names - convert object back to array
							if (typeof entityType.model_names === 'object' && entityType.model_names !== null) {
								entityType.model_names = Object.values(entityType.model_names).filter(Boolean)
							} else {
								entityType.model_names = []
							}
						}
					})
				}
			} catch (cacheError) {
				console.warn('Cache system failed for all entity types, falling back to database:', cacheError.message)
				entityTypes = await entityTypeQueries.findAllEntityTypes(orgCodes, tenantCodes, attributes, filter)
			}

			return entityTypes
		} catch (error) {
			throw error
		}
	}

	/**
	 * Read all entity types and entities with caching and fallback
	 * @method
	 * @name readAllEntityTypesAndEntitiesCached
	 * @param {Object} filter - Filter criteria for entity types
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Array} - Cached entity types with entities
	 */
	static async readAllEntityTypesAndEntitiesCached(filter, orgCode, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode || !defaults.tenantCode) {
				throw new Error('DEFAULT_ORG_CODE_OR_TENANT_CODE_NOT_SET')
			}

			// Create tenant and org based cache key for all entity types with entities
			const modelNames =
				filter.model_names?.[Op.contains] || filter.model_names?.[Op.overlap] || filter.model_names || []
			const modelName = Array.isArray(modelNames) ? modelNames[0] : modelNames || 'all'
			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:${common.CACHE_CONFIG.namespaces.entity_types.name}:all_${modelName}`

			let entityTypesWithEntities
			try {
				// Use direct Redis operations without tenant/org codes
				const cached = await cacheHelper.get(cacheKey)
				if (cached !== null && cached !== undefined) {
					entityTypesWithEntities = cached
				} else {
					// Merge tenant codes including defaults for fallback
					const tenantCodes = { [Op.in]: [defaults.tenantCode, tenantCode] }
					const dbResult = await entityTypeQueries.findAllEntityTypesAndEntities(filter, tenantCodes)

					// Ensure model_names arrays are properly maintained
					if (dbResult && Array.isArray(dbResult)) {
						dbResult.forEach((entityType) => {
							if (entityType.model_names && !Array.isArray(entityType.model_names)) {
								// Fix corrupted model_names - convert object back to array
								if (typeof entityType.model_names === 'object' && entityType.model_names !== null) {
									entityType.model_names = Object.values(entityType.model_names).filter(Boolean)
								} else {
									entityType.model_names = []
								}
							}
						})
					}

					entityTypesWithEntities = dbResult
					if (entityTypesWithEntities !== undefined) {
						const ttl = common.CACHE_CONFIG.namespaces.entity_types.defaultTtl || 0
						await cacheHelper.set(cacheKey, entityTypesWithEntities, ttl || undefined)
					}
				}
			} catch (cacheError) {
				console.warn(
					'Cache system failed for all entity types with entities, falling back to database:',
					cacheError.message
				)
				const tenantCodes = { [Op.in]: [defaults.tenantCode, tenantCode] }
				entityTypesWithEntities = await entityTypeQueries.findAllEntityTypesAndEntities(filter, tenantCodes)
			}

			return entityTypesWithEntities
		} catch (error) {
			throw error
		}
	}

	/**
	 * Read one entity type with caching and fallback
	 * @method
	 * @name readOneEntityTypeCached
	 * @param {Object} filter - Filter criteria for entity type
	 * @param {Array|Object} tenantCodes - Tenant codes
	 * @param {Object} options - Query options
	 * @returns {Object} - Cached entity type
	 */
	static async readOneEntityTypeCached(filter, tenantCodes, options = {}) {
		try {
			// Create tenant and org based cache key for one entity type
			const tenantCode = Array.isArray(tenantCodes) ? tenantCodes[0] : tenantCodes
			const orgCode = filter.organization_code || 'default'
			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:${common.CACHE_CONFIG.namespaces.entity_types.name}:one_type`

			let entityType
			try {
				// Use direct Redis operations with tenant/org structure
				const cached = await cacheHelper.get(cacheKey)
				if (cached !== null && cached !== undefined) {
					entityType = cached
				} else {
					const dbResult = await entityTypeQueries.findOneEntityType(filter, tenantCodes, options)

					// Ensure model_names arrays are properly maintained
					if (dbResult && dbResult.model_names && !Array.isArray(dbResult.model_names)) {
						// Fix corrupted model_names - convert object back to array
						if (typeof dbResult.model_names === 'object' && dbResult.model_names !== null) {
							dbResult.model_names = Object.values(dbResult.model_names).filter(Boolean)
						} else {
							dbResult.model_names = []
						}
					}

					entityType = dbResult
					if (entityType !== undefined) {
						const ttl = common.CACHE_CONFIG.namespaces.entity_types.defaultTtl || 0
						await cacheHelper.set(cacheKey, entityType, ttl || undefined)
					}
				}

				// Fix model_names arrays if they got corrupted in cache
				if (entityType && entityType.model_names && !Array.isArray(entityType.model_names)) {
					// Fix corrupted model_names - convert object back to array
					if (typeof entityType.model_names === 'object' && entityType.model_names !== null) {
						entityType.model_names = Object.values(entityType.model_names).filter(Boolean)
					} else {
						entityType.model_names = []
					}
				}
			} catch (cacheError) {
				console.warn('Cache system failed for one entity type, falling back to database:', cacheError.message)
				entityType = await entityTypeQueries.findOneEntityType(filter, tenantCodes, options)
			}

			return entityType
		} catch (error) {
			throw error
		}
	}

	/**
	 * Delete All entity type and entities based on entityType value.
	 * @method
	 * @name delete
	 * @param {Object} bodyData -  body data.
	 * @returns {JSON} - Entity deleted response.
	 */

	static async deleteEntityTypesAndEntities(value, tenantCode) {
		try {
			const deleteCount = await entityTypeQueries.deleteEntityTypesAndEntities({
				status: 'ACTIVE',
				value: { [Op.in]: value },
				tenant_code: tenantCode,
			})

			if (deleteCount === 0) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ENTITY_TYPE_AND_ENTITES_DELETED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Invalidate entity-type related caches after CUD operations
	 * Following the user service pattern for entity type cache invalidation
	 */
	static async _invalidateEntityTypeCaches({ tenantCode, orgCode }) {
		try {
			// Use tenant and org based cache eviction
			await cacheHelper.scanAndDelete(
				`tenant:${tenantCode}:org:${orgCode}:${common.CACHE_CONFIG.namespaces.entity_types.name}:*`
			)

			// Also evict related entity caches for this tenant/org
			await cacheHelper.scanAndDelete(
				`tenant:${tenantCode}:org:${orgCode}:${common.CACHE_CONFIG.namespaces.entities.name}:*`
			)

			// Evict profile-related caches as entity types affect profiles
			await cacheHelper.scanAndDelete(
				`tenant:${tenantCode}:org:${orgCode}:${common.CACHE_CONFIG.namespaces.mentor_profile.name}:*`
			)
			await cacheHelper.scanAndDelete(
				`tenant:${tenantCode}:org:${orgCode}:${common.CACHE_CONFIG.namespaces.mentee_profile.name}:*`
			)
		} catch (err) {
			console.error('Entity type cache invalidation failed', err)
			// Don't throw - cache failures should not block main operations
		}
	}
}
