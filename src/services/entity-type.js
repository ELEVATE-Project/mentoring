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
		console.log('🚀 [CREATE] Starting entity type creation with data:', {
			value: bodyData.value,
			model_names: bodyData.model_names,
		})
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
			console.log('✅ [CREATE] Entity type created successfully')

			// CREATE operation does NOT cache - only READ operations set cache
			// Cache will be populated when entity is first read

			// Invalidate display properties cache since entity types changed
			try {
				await cacheHelper.displayProperties.delete(tenantCode, orgCode)
				console.log(`🗑️ Display properties cache invalidated after entity type creation`)
			} catch (cacheError) {
				console.error(`❌ Failed to invalidate display properties cache:`, cacheError)
			}

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
				console.log('📋 [UPDATE CACHE] Original entity:', {
					id: originalEntity?.id,
					value: originalEntity?.value,
					modelNames: originalEntity?.model_names,
				})
			} catch (error) {
				console.warn('⚠️ [UPDATE CACHE] Could not fetch original entity for cache cleanup:', error)
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
				console.log('🔄 [UPDATE CACHE] Fetching complete updated entity type with entities...')

				const updatedEntity = updatedEntityType[0]

				// Delete old cache entries if value or model_names changed
				if (originalEntity) {
					const valueChanged = originalEntity.value !== updatedEntity.value
					const oldModelNames = originalEntity.model_names || []
					const newModelNames = updatedEntity.model_names || []
					const modelNamesChanged =
						JSON.stringify(oldModelNames.sort()) !== JSON.stringify(newModelNames.sort())

					if (valueChanged || modelNamesChanged) {
						console.log('🗑️ [UPDATE CACHE] Entity changed, deleting old cache entries...')

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
								console.log(
									`✅ [UPDATE CACHE] Successfully deleted old cache: ${modelName}:${originalEntity.value}`
								)
							} catch (delError) {
								console.error(
									`❌ [UPDATE CACHE] Failed to delete old cache ${modelName}:${originalEntity.value}:`,
									delError
								)
							}
						}

						// 2. If only model names changed (not value), also delete from removed models with current value
						if (!valueChanged && modelNamesChanged) {
							const removedModels = oldModelNames.filter((model) => !newModelNames.includes(model))
							console.log(`🗑️ [UPDATE CACHE] Models removed: ${removedModels.join(', ')}`)

							for (const removedModel of removedModels) {
								try {
									await cacheHelper.entityTypes.delete(
										tenantCode,
										orgCode,
										removedModel,
										updatedEntity.value
									)
									console.log(
										`✅ [UPDATE CACHE] Successfully deleted removed model cache: ${removedModel}:${updatedEntity.value}`
									)
								} catch (delError) {
									console.error(
										`❌ [UPDATE CACHE] Failed to delete removed model cache ${removedModel}:${updatedEntity.value}:`,
										delError
									)
								}
							}
						}
					} else {
						console.log('ℹ️ [UPDATE CACHE] No cache cleanup needed - no value or model name changes')
					}
				} else {
					console.warn('⚠️ [UPDATE CACHE] No original entity found - skipping cache cleanup')
				}

				// Fetch complete entity type with entities using cache
				const completeUpdatedEntity = await entityTypeCache.getEntityTypesAndEntitiesWithFilter(
					{ id: updatedEntity.id, organization_code: orgCode, tenant_code: tenantCode },
					[tenantCode]
				)

				let entityWithEntities = null
				if (completeUpdatedEntity && completeUpdatedEntity.length > 0) {
					entityWithEntities = completeUpdatedEntity[0]
					console.log('✅ [UPDATE CACHE] Found complete entity with entities')
				} else {
					// Fallback: use basic updated entity with empty entities array
					entityWithEntities = {
						...updatedEntity,
						entities: [], // Consistent structure
					}
					console.log('⚠️ [UPDATE CACHE] Using basic entity data with empty entities')
				}

				// For each model this entity belongs to, cache individually
				if (updatedEntity.model_names && Array.isArray(updatedEntity.model_names)) {
					for (const modelName of updatedEntity.model_names) {
						console.log(`🔄 [UPDATE CACHE] Caching for model: ${modelName}`)

						// Cache complete entity type with entities (Reset/SetOrGet operation)
						await cacheHelper.entityTypes.set(
							tenantCode,
							orgCode,
							modelName,
							updatedEntity.value,
							entityWithEntities
						)
						console.log(`✅ [UPDATE CACHE] Updated cached entity type: ${modelName}:${updatedEntity.value}`)
					}
				}

				console.log('✅ [UPDATE CACHE] Entity type cache updated successfully')
			} catch (cacheError) {
				console.error('❌ [UPDATE CACHE ERROR] Failed to perform selective cache update:', cacheError)
				console.log('🔄 [UPDATE CACHE] Clearing cache for this specific entity value only...')

				// Fallback: clear cache only for this specific entity value
				const updatedEntity = updatedEntityType[0]
				if (updatedEntity.model_names && Array.isArray(updatedEntity.model_names)) {
					for (const modelName of updatedEntity.model_names) {
						try {
							await cacheHelper.entityTypes.delete(tenantCode, orgCode, modelName, updatedEntity.value)
							console.log(`🗑️ [UPDATE FALLBACK] Cleared cache for: ${modelName}:${updatedEntity.value}`)
						} catch (delError) {
							console.error(`Failed to clear cache for ${modelName}:${updatedEntity.value}:`, delError)
						}
					}
				}
			}

			// Invalidate display properties cache since entity types changed
			try {
				await cacheHelper.displayProperties.delete(tenantCode, orgCode)
				console.log(`🗑️ Display properties cache invalidated after entity type update`)
			} catch (cacheError) {
				console.error(`❌ Failed to invalidate display properties cache:`, cacheError)
			}

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
			console.log('📖 [CACHE READ] Fetching entity types from database (no bulk cache for readAll)...')

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

			// Fetch all entity types with model_names
			const entities = await entityTypeQueries.findAllEntityTypes(
				{ [Op.or]: [orgCode, defaults.orgCode] },
				{ [Op.in]: [tenantCode, defaults.tenantCode] },
				attributes
			)

			if (!entities.length) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Group entity types by model names
			const freshGroupedByModel = {}
			const allDistinctModels = new Set()

			entities.forEach((entity) => {
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

			// Cache individual entity types with complete data (including entities)
			console.log('💾 [CACHE WRITE] Fetching and caching complete entity types with entities...')
			for (const [modelName, entityTypesInModel] of Object.entries(freshGroupedByModel)) {
				for (const entityType of entityTypesInModel) {
					try {
						// Fetch complete entity type with entities for consistent caching
						const completeEntityType = await entityTypeCache.getEntityTypesAndEntitiesWithFilter(
							{
								id: entityType.id,
								value: entityType.value,
								organization_code: { [Op.in]: [orgCode, defaults.orgCode] },
								tenant_code: { [Op.in]: [tenantCode, defaults.tenantCode] },
							},
							[tenantCode, defaults.tenantCode]
						)

						let entityToCache = entityType
						if (completeEntityType && completeEntityType.length > 0) {
							// Use complete entity with entities
							entityToCache = completeEntityType[0]
							console.log(
								`💾 [CACHE WRITE] Found complete entity with ${
									entityToCache.entities?.length || 0
								} entities`
							)
						} else {
							// Fallback: add empty entities array for consistency
							entityToCache = {
								...entityType,
								entities: [],
							}
							console.log(`⚠️ [CACHE WRITE] Using basic entity with empty entities array`)
						}

						await cacheHelper.entityTypes.set(
							tenantCode,
							orgCode,
							modelName,
							entityType.value,
							entityToCache
						)
						console.log(`💾 [CACHE WRITE] Cached complete entity type: ${modelName}:${entityType.value}`)
					} catch (cacheError) {
						console.error(`Failed to cache entity type '${modelName}:${entityType.value}':`, cacheError)
					}
				}
			}
			console.log('✅ [CACHE WRITE] Individual entity types with complete data cached')

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_TYPE_FETCHED_SUCCESSFULLY',
				result: freshGroupedByModel,
			})
		} catch (error) {
			throw error
		}
	}

	static async readUserEntityTypes(body, orgCode, tenantCode) {
		try {
			// Try to get from cache first
			const entityValue = body.value
			const modelName = body.model_name

			if (!modelName) {
				return responses.failureResponse({
					message: 'MODEL_NAME_REQUIRED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			console.log(`📖 [CACHE READ] Checking cache for entity type: ${modelName}:${entityValue}`)
			const cachedEntityType = await cacheHelper.entityTypes.get(tenantCode, orgCode, modelName, entityValue)
			if (cachedEntityType) {
				console.log(`✅ [CACHE HIT] Found cached entity type: ${modelName}:${entityValue}`)
				// The cached data should be the complete entity type with entities
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'ENTITY_TYPE_FETCHED_SUCCESSFULLY',
					result: { entity_types: [cachedEntityType] },
				})
			}
			console.log(
				`❌ [CACHE MISS] Entity type not in cache: ${modelName}:${entityValue}, fetching from database...`
			)

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
				value: entityValue,
				status: 'ACTIVE',
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

			// Cache the complete entity type with entities (your preferred format)
			if (prunedEntities.length > 0) {
				const entityTypeToCache = prunedEntities[0] // Should be the complete entity type with entities
				console.log(`💾 [CACHE WRITE] Caching complete entity type with entities: ${modelName}:${entityValue}`)
				await cacheHelper.entityTypes.set(tenantCode, orgCode, modelName, entityValue, entityTypeToCache)
				console.log(`✅ [CACHE WRITE] Cached entity type: ${modelName}:${entityValue}`)
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
			console.log('🔍 [DELETE CACHE] Getting entity details before deletion...')
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

			console.log('📋 [DELETE CACHE] Entity to delete:', {
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
				console.log('🗑️ [DELETE CACHE] Removing individual entity type from cache...')

				// For each model this entity belonged to
				if (entityToDelete.model_names && Array.isArray(entityToDelete.model_names)) {
					for (const modelName of entityToDelete.model_names) {
						console.log(`🗑️ [DELETE CACHE] Processing model: ${modelName}`)

						// Remove the specific entity type cache
						await cacheHelper.entityTypes.delete(
							tenantCode,
							organizationCode,
							modelName,
							entityToDelete.value
						)
						console.log(
							`✅ [DELETE CACHE] Removed cached entity type: ${modelName}:${entityToDelete.value}`
						)
					}
				}

				console.log('✅ [DELETE CACHE] Entity type cache removal completed')
			} catch (cacheError) {
				console.error('❌ [DELETE CACHE ERROR] Failed to perform selective cache removal:', cacheError)
				console.log('🔄 [DELETE CACHE] Retrying individual cache removal...')

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
							console.log(`🗑️ [DELETE FALLBACK] Cleared cache for: ${modelName}:${entityToDelete.value}`)
						} catch (retryError) {
							console.error(
								`Failed to retry clear cache for ${modelName}:${entityToDelete.value}:`,
								retryError
							)
						}
					}
				}
			}

			// Invalidate display properties cache since entity types changed
			try {
				await cacheHelper.displayProperties.delete(tenantCode, organizationCode)
				console.log(`🗑️ Display properties cache invalidated after entity type deletion`)
			} catch (cacheError) {
				console.error(`❌ Failed to invalidate display properties cache:`, cacheError)
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
			// get entityTypes with entities data using cached helper
			let entityTypesWithEntities = await entityTypeCache.getEntityTypesAndEntitiesWithFilter(filter, tenantCodes)
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
	 * Get grouped entity types from cache by reading individual model caches
	 * This avoids data duplication by formatting raw cached data
	 */
	static async _getGroupedEntityTypesFromCache(tenantCode, orgCode) {
		try {
			console.log('📋 [CACHE FORMAT] Attempting to get all model caches...')

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

			console.log('📋 [CACHE FORMAT] Found models to check:', Array.from(allModels))

			const groupedByModel = {}
			let foundAnyCache = false

			// Check cache for each model
			for (const modelName of allModels) {
				console.log(`📖 [CACHE FORMAT] Checking cache for model: ${modelName}`)
				const modelEntityTypes = await cacheHelper.entityTypes.get(tenantCode, orgCode, modelName)

				if (modelEntityTypes && Array.isArray(modelEntityTypes)) {
					console.log(
						`✅ [CACHE FORMAT] Found cache for model ${modelName} with ${modelEntityTypes.length} entities`
					)
					groupedByModel[modelName] = modelEntityTypes
					foundAnyCache = true
				} else {
					console.log(`❌ [CACHE FORMAT] No cache found for model: ${modelName}`)
					// If any model is missing from cache, we need to rebuild all
					return null
				}
			}

			if (foundAnyCache) {
				console.log('✅ [CACHE FORMAT] Successfully formatted grouped data from cache')
				return groupedByModel
			}

			console.log('❌ [CACHE FORMAT] No cached data found')
			return null
		} catch (error) {
			console.error('❌ [CACHE FORMAT] Error getting grouped data from cache:', error)
			return null
		}
	}

	/**
	 * Clear all entity type caches and force rebuild with new format
	 * This should be called after updating cache structure
	 */
	static async clearAndRebuildCache(tenantCode, orgCode) {
		try {
			console.log('🧹 [CACHE CLEAR] Clearing all entity type caches...')
			await cacheHelper.evictNamespace({ tenantCode, orgCode, ns: 'entityTypes' })
			console.log('✅ [CACHE CLEAR] All entity type caches cleared')

			console.log('🔄 [CACHE REBUILD] Rebuilding cache with new format...')
			const result = await this.readAllSystemEntityTypes(orgCode, tenantCode)
			console.log('✅ [CACHE REBUILD] Cache rebuilt successfully')

			return result
		} catch (error) {
			console.error('❌ [CACHE CLEAR] Error clearing and rebuilding cache:', error)
			throw error
		}
	}
}
