// Dependencies
const httpStatusCode = require('@generics/http-status')
const entityTypeQueries = require('../database/queries/entityType')
const menteeExtensionQueries = require('../database/queries/userExtension')
const mentorExtensionQueries = require('../database/queries/mentorExtension')
const sessionQueries = require('../database/queries/sessions')
const { UniqueConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const { removeDefaultOrgEntityTypes } = require('@generics/utils')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const utils = require('@generics/utils')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const cacheHelper = require('@generics/cacheHelper')
const entityTypeCache = require('@helpers/entityTypeCache')

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

			// CREATE operation does NOT cache - only READ operations set cache
			// Cache will be populated when entity is first read

			// Clear user caches since entity types affect user profiles
			await this._clearUserCachesForEntityTypeChange(
				orgCode,
				tenantCode,
				bodyData.model_names ? bodyData.model_names[0] : null,
				bodyData.value
			)

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
			// Get original entity before update to handle cache cleanup
			let originalEntity = null
			try {
				originalEntity = await entityTypeQueries.findOneEntityType(
					{ id, organization_code: orgCode },
					tenantCode
				)
			} catch (error) {
				// Could not fetch original entity for cache cleanup
			}

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

			// Update individual entity type cache with complete data
			try {
				const updatedEntity = updatedEntityType[0]

				// Delete old cache entries if value or model_names changed
				if (originalEntity) {
					const valueChanged = originalEntity.value !== updatedEntity.value
					const oldModelNames = originalEntity.model_names || []
					const newModelNames = updatedEntity.model_names || []
					const modelNamesChanged =
						JSON.stringify(oldModelNames.sort()) !== JSON.stringify(newModelNames.sort())

					if (valueChanged || modelNamesChanged) {
						// Strategy: Delete all old cache entries, then create new ones
						// This handles both value changes and model removals

						// 1. Delete from all old model_names with old value
						for (const modelName of oldModelNames) {
							try {
								await cacheHelper.entityTypes.delete(
									tenantCode,
									orgCode,
									modelName,
									originalEntity.value
								)
							} catch (delError) {
								// Failed to delete old cache - continue operation
							}
						}

						// 2. If only model names changed (not value), also delete from removed models with current value
						if (!valueChanged && modelNamesChanged) {
							const removedModels = oldModelNames.filter((model) => !newModelNames.includes(model))

							for (const removedModel of removedModels) {
								try {
									await cacheHelper.entityTypes.delete(
										tenantCode,
										orgCode,
										removedModel,
										updatedEntity.value
									)
								} catch (delError) {
									// Failed to delete removed model cache - continue operation
								}
							}
						}
					} else {
					}
				} else {
					// No original entity found - skipping cache cleanup
				}

				// Fetch complete entity type with entities using cache
				const completeUpdatedEntity = await entityTypeCache.getEntityTypesAndEntitiesWithFilter(
					{ id: updatedEntity.id, organization_code: orgCode, tenant_code: tenantCode },
					[tenantCode]
				)

				let entityWithEntities = null
				if (completeUpdatedEntity && completeUpdatedEntity.length > 0) {
					entityWithEntities = completeUpdatedEntity[0]
				} else {
					// Fallback: use basic updated entity with empty entities array
					entityWithEntities = {
						...updatedEntity,
						entities: [], // Consistent structure
					}
				}

				// For each model this entity belongs to, cache individually
				if (updatedEntity.model_names && Array.isArray(updatedEntity.model_names)) {
					for (const modelName of updatedEntity.model_names) {
						// Cache complete entity type with entities (Reset/SetOrGet operation)
						await cacheHelper.entityTypes.set(
							tenantCode,
							orgCode,
							modelName,
							updatedEntity.value,
							entityWithEntities
						)
					}
				}
			} catch (cacheError) {
				// Failed to perform selective cache update - continue operation

				// Fallback: clear cache only for this specific entity value
				const updatedEntity = updatedEntityType[0]
				if (updatedEntity.model_names && Array.isArray(updatedEntity.model_names)) {
					for (const modelName of updatedEntity.model_names) {
						try {
							await cacheHelper.entityTypes.delete(tenantCode, orgCode, modelName, updatedEntity.value)
						} catch (delError) {
							// Failed to clear cache - continue operation
						}
					}
				}
			}

			// Clear user caches since entity types affect user profiles
			const updatedEntity = updatedEntityType[0]
			await this._clearUserCachesForEntityTypeChange(
				orgCode,
				tenantCode,
				updatedEntity.model_names ? updatedEntity.model_names[0] : null,
				updatedEntity.value
			)

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
			const attributes = ['value', 'label', 'id', 'model_names']
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

			// Try to get from existing individual entity caches first
			const flattenedFromCache = []
			const knownModelNames = common.entityTypeModelNames || ['Session', 'UserExtension']

			// Get all unique entity values from database to check cache
			const entities = await entityTypeQueries.findAllEntityTypes(
				{ [Op.or]: [orgCode, defaults.orgCode] },
				{ [Op.in]: [tenantCode, defaults.tenantCode] },
				['value']
			)

			if (!entities.length) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const uniqueValues = [...new Set(entities.map((e) => e.value))]
			const cachedEntities = []
			const uncachedValues = []

			// Check cache for each entity value across all model names
			for (const entityValue of uniqueValues) {
				let foundInCache = false
				for (const modelName of knownModelNames) {
					try {
						const cachedEntity = await cacheHelper.entityTypes.get(
							tenantCode,
							orgCode,
							modelName,
							entityValue
						)
						if (cachedEntity) {
							// Extract just the fields we need for flattened response
							cachedEntities.push({
								value: cachedEntity.value,
								label: cachedEntity.label,
								id: cachedEntity.id,
							})
							foundInCache = true
							break
						}
					} catch (cacheError) {
						// Cache lookup failed, continue
					}
				}

				if (!foundInCache) {
					uncachedValues.push(entityValue)
				}
			}

			// If we got everything from cache, return it
			if (uncachedValues.length === 0 && cachedEntities.length > 0) {
				console.log(`🎯 All entity types found in individual caches`)
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'ENTITY_TYPE_FETCHED_SUCCESSFULLY',
					result: cachedEntities,
				})
			}

			// Fetch complete data from database if cache miss
			const fullEntities = await entityTypeQueries.findAllEntityTypes(
				{ [Op.or]: [orgCode, defaults.orgCode] },
				{ [Op.in]: [tenantCode, defaults.tenantCode] },
				attributes
			)

			// Group entity types by model names for caching
			const freshGroupedByModel = {}
			const allDistinctModels = new Set()

			fullEntities.forEach((entity) => {
				// Get model names for this entity (could be multiple models)
				const modelNames = entity.model_names || ['unknown']

				modelNames.forEach((modelName) => {
					allDistinctModels.add(modelName)

					if (!freshGroupedByModel[modelName]) {
						freshGroupedByModel[modelName] = []
					}

					// Add entity to this model group (including model_names for validation)
					freshGroupedByModel[modelName].push({
						value: entity.value,
						label: entity.label,
						id: entity.id,
						model_names: entity.model_names,
					})
				})
			})

			// Cache individual entity types using existing cache structure
			for (const [modelName, entityTypesInModel] of Object.entries(freshGroupedByModel)) {
				for (const entityType of entityTypesInModel) {
					try {
						await cacheHelper.entityTypes.set(tenantCode, orgCode, modelName, entityType.value, entityType)
					} catch (cacheError) {
						// Failed to cache entity type - continue operation
					}
				}
			}

			// Create flattened response removing duplicates
			const uniqueEntitiesMap = new Map()
			fullEntities.forEach((entity) => {
				if (!uniqueEntitiesMap.has(entity.id)) {
					uniqueEntitiesMap.set(entity.id, {
						value: entity.value,
						label: entity.label,
						id: entity.id,
					})
				}
			})

			const flattenedResult = Array.from(uniqueEntitiesMap.values())

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_TYPE_FETCHED_SUCCESSFULLY',
				result: flattenedResult,
			})
		} catch (error) {
			throw error
		}
	}

	static async readUserEntityTypes(body, orgCode, tenantCode) {
		try {
			const entityValue = body.value

			// Handle both single values and arrays
			const entityValues = Array.isArray(entityValue) ? entityValue : [entityValue]
			const allEntityTypes = []

			// Process each entity value individually
			for (const singleEntityValue of entityValues) {
				// Step 1: Try to get from cache for all possible models
				let foundInCache = false
				for (const modelName of common.entityTypeModelNames) {
					const cachedEntityType = await cacheHelper.entityTypes.get(
						tenantCode,
						orgCode,
						modelName,
						singleEntityValue
					)
					if (cachedEntityType) {
						// The cached data should be the complete entity type with entities
						allEntityTypes.push(
							...(Array.isArray(cachedEntityType) ? cachedEntityType : [cachedEntityType])
						)
						foundInCache = true
						break
					}
				}

				// If not found in cache, will be processed in database query below
				if (!foundInCache) {
					// Continue to database query for this value
				}
			}

			// If all values were found in cache, return them
			if (allEntityTypes.length === entityValues.length) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'ENTITY_TYPE_FETCHED_SUCCESSFULLY',
					result: { entity_types: allEntityTypes },
				})
			}

			// Step 2: If not found in cache, query database without model restriction
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
				value: Array.isArray(entityValue) ? { [Op.in]: entityValue } : entityValue,
				status: common.ACTIVE_STATUS,
				organization_code: {
					[Op.in]: [orgCode, defaults.orgCode],
				},
				tenant_code: { [Op.in]: [defaults.tenantCode, tenantCode] },
			}
			const entityTypes = await entityTypeCache.getEntityTypesAndEntitiesWithFilter(filter, [
				defaults.tenantCode,
				tenantCode,
			])

			const prunedEntities = removeDefaultOrgEntityTypes(entityTypes, defaults.orgCode)

			if (prunedEntities.length == 0) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Cache each entity type individually for all its model names
			if (prunedEntities.length > 0) {
				for (const entityTypeToCache of prunedEntities) {
					const entityModelNames = entityTypeToCache.model_names || []
					const entityTypeValue = entityTypeToCache.value

					// Cache for each model name this entity type belongs to
					for (const modelName of entityModelNames) {
						await cacheHelper.entityTypes.set(
							tenantCode,
							orgCode,
							modelName,
							entityTypeValue,
							entityTypeToCache
						)
					}
				}
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
			// FIRST: Get the entity details before deleting it
			const entityToDelete = await entityTypeQueries.findOneEntityType(
				{ id, organization_code: organizationCode, tenant_code: tenantCode },
				tenantCode
			)

			if (!entityToDelete) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Clear cache for affected models before deletion
			await this._clearUserCachesForEntityTypeChange(organizationCode, tenantCode, {
				id: entityToDelete.id,
				value: entityToDelete.value,
				modelNames: entityToDelete.model_names,
			})

			// SECOND: Delete from database
			const deleteCount = await entityTypeQueries.deleteOneEntityType(id, organizationCode, tenantCode)
			if (deleteCount === 0) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// THIRD: Remove individual entity type from cache
			try {
				// For each model this entity belonged to
				if (entityToDelete.model_names && Array.isArray(entityToDelete.model_names)) {
					for (const modelName of entityToDelete.model_names) {
						// Remove the specific entity type cache
						await cacheHelper.entityTypes.delete(
							tenantCode,
							organizationCode,
							modelName,
							entityToDelete.value
						)
					}
				}
			} catch (cacheError) {
				// Failed to perform selective cache removal - continue operation

				// Fallback: retry removing only this specific entity's cache
				if (entityToDelete.model_names && Array.isArray(entityToDelete.model_names)) {
					for (const modelName of entityToDelete.model_names) {
						try {
							await cacheHelper.entityTypes.delete(
								tenantCode,
								organizationCode,
								modelName,
								entityToDelete.value
							)
						} catch (retryError) {
							// Failed to retry clear cache - continue operation
						}
					}
				}
			}

			// Clear user caches since entity types affect user profiles
			await this._clearUserCachesForEntityTypeChange(
				organizationCode,
				tenantCode,
				entityToDelete.model_names ? entityToDelete.model_names[0] : null,
				entityToDelete.value
			)

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
				status: common.ACTIVE_STATUS,
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
			if (entityType && entityType.length > 0) filter.value = entityType
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
	 * Delete All entity type and entities based on entityType value.
	 * @method
	 * @name delete
	 * @param {Object} bodyData -  body data.
	 * @returns {JSON} - Entity deleted response.
	 */

	static async deleteEntityTypesAndEntities(value, tenantCode) {
		try {
			const deleteCount = await entityTypeQueries.deleteEntityTypesAndEntities({
				status: common.ACTIVE_STATUS,
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
	 * Get grouped entity types from cache by reading individual model caches
	 * This avoids data duplication by formatting raw cached data
	 */
	/**
	 * Clear user caches when entity types change
	 * When entity types are created/updated/deleted, user profiles become stale
	 * because they contain processed entity type data and display properties
	 * @method
	 * @name _clearUserCachesForEntityTypeChange
	 * @param {String} organizationCode - organization code affected
	 * @param {String} tenantCode - tenant code affected
	 * @param {String} modelName - model name affected (optional)
	 * @param {String} entityValue - entity value affected (optional)
	 * @returns {Promise<void>}
	 */
	static async _clearUserCachesForEntityTypeChange(
		organizationCode,
		tenantCode,
		modelName = null,
		entityValue = null
	) {
		try {
			const logContext = modelName ? `${modelName}:${entityValue}` : 'global'

			// Strategy: Clear model-specific caches based on entity type model since:
			// 1. Entity types affect profile validation and display properties
			// 2. Users can have entity values in their profiles
			// 3. Display properties are built from entity types
			// 4. User profiles are cached with processed entity type data

			const clearPromises = []

			// 1. Clear display properties cache (affects all users in org)
			clearPromises.push(
				cacheHelper.displayProperties.delete(tenantCode, organizationCode).catch((error) => {
					/* Failed to clear display properties cache - continue operation */
				})
			)

			// 2. Clear entity type caches for unified model strategy
			if (modelName) {
				clearPromises.push(
					cacheHelper.entityTypes
						.delete(tenantCode, organizationCode, `model:${modelName}:__ALL__`)
						.catch((error) => {
							/* Failed to clear unified entity type cache - continue operation */
						})
				)
			}

			// 3. Clear model-specific user caches based on the entity type model
			if (modelName) {
				// Get model names to determine which caches need clearing
				const [menteeModelName, mentorModelName, sessionModelName] = await Promise.all([
					menteeExtensionQueries.getModelName(),
					mentorExtensionQueries.getModelName(),
					sessionQueries.getModelName(),
				])

				// Active cache clearing for specific models based on entity type
				// Clear user caches immediately when entity types affect specific models

				if (modelName === menteeModelName) {
					// Clear all mentee caches for this organization
					try {
						const users = await menteeExtensionQueries.getAllUsersByOrgId([organizationCode], tenantCode)
						const menteeUserIds = users.map((user) => user.user_id)

						// Clear mentee caches for all users in organization
						const menteeClearPromises = menteeUserIds.map((userId) =>
							cacheHelper.mentee.delete(tenantCode, organizationCode, userId).catch((error) => {
								/* Failed to clear mentee cache - continue operation */
							})
						)
						clearPromises.push(...menteeClearPromises)
					} catch (error) {
						// Failed to enumerate mentee users - continue operation
					}
				}

				if (modelName === mentorModelName) {
					// Clear all mentor caches for this organization
					try {
						// Get all users who might be mentors in this organization
						const users = await menteeExtensionQueries.getAllUsersByOrgId([organizationCode], tenantCode)
						const mentorUserIds = users.map((user) => user.user_id)

						// Clear mentor caches for all users in organization (users can be both mentee and mentor)
						const mentorClearPromises = mentorUserIds.map((userId) =>
							cacheHelper.mentor.delete(tenantCode, organizationCode, userId).catch((error) => {
								/* Failed to clear mentor cache - continue operation */
							})
						)
						clearPromises.push(...mentorClearPromises)
					} catch (error) {
						// Failed to enumerate mentor users - continue operation
					}
				}

				if (modelName === sessionModelName) {
					// For session model, we don't have session enumeration by org
					// Session caches are typically cleared by individual session operations
					// Entity types affecting sessions would be rare (custom session fields)
					// Skip organization-wide session cache clearing to avoid performance impact
				}
			}

			// Execute all cache clearing operations in parallel
			await Promise.all(clearPromises)

			// For high-frequency entity type changes, consider implementing:
			// - Background cache warming after entity type changes
			// - Batch user cache clearing with organization user enumeration
			// - Event-driven cache invalidation system
		} catch (error) {
			// Failed to clear user caches for entity type change - continue operation
			throw error
		}
	}

	static async _getGroupedEntityTypesFromCache(tenantCode, orgCode) {
		try {
			// We need to know which models to check - get from database once to know models
			const defaults = await getDefaults()
			const allEntityTypes = await entityTypeQueries.findAllEntityTypes(
				{ [Op.or]: [orgCode, defaults.orgCode] },
				{ [Op.in]: [tenantCode, defaults.tenantCode] },
				['model_names']
			)

			// Get unique model names
			const allModels = new Set()
			allEntityTypes.forEach((entity) => {
				const modelNames = entity.model_names || []
				modelNames.forEach((modelName) => allModels.add(modelName))
			})

			const groupedByModel = {}
			let foundAnyCache = false

			// Check cache for each model
			for (const modelName of allModels) {
				const modelEntityTypes = await cacheHelper.entityTypes.get(tenantCode, orgCode, modelName)

				if (modelEntityTypes && Array.isArray(modelEntityTypes)) {
					groupedByModel[modelName] = modelEntityTypes
					foundAnyCache = true
				} else {
					// If any model is missing from cache, we need to rebuild all
					return null
				}
			}

			if (foundAnyCache) {
				return groupedByModel
			}

			return null
		} catch (error) {
			// Error getting grouped data from cache - continue operation
			return null
		}
	}

	/**
	 * Clear all entity type caches and force rebuild with new format
	 * This should be called after updating cache structure
	 */
	static async clearAndRebuildCache(tenantCode, orgCode) {
		try {
			await cacheHelper.evictNamespace({ tenantCode, orgCode, ns: 'entityTypes' })

			const result = await this.readAllSystemEntityTypes(orgCode, tenantCode)

			return result
		} catch (error) {
			// Error clearing and rebuilding cache - continue operation
			throw error
		}
	}
}
