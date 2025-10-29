// Dependencies
const httpStatusCode = require('@generics/http-status')
const entityTypeQueries = require('../database/queries/entity')
const { UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const responses = require('@helpers/responses')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const cacheHelper = require('@generics/cacheHelper')

module.exports = class EntityHelper {
	/**
	 * Create entity.
	 * @method
	 * @name create
	 * @param {Object} bodyData - entity body data.
	 * @param {String} id -  id.
	 * @param {String} tenantCode - tenant code.
	 * @returns {JSON} - Entity created response.
	 */

	static async create(bodyData, id, tenantCode) {
		// Create sanitized data object to avoid parameter mutation
		const sanitizedData = {
			...bodyData,
			created_by: id,
			updated_by: id,
		}
		try {
			// Optimized: Validate entity_type exists before creation - better UX than constraint errors
			const entity = await entityTypeQueries.createEntityWithValidation(sanitizedData, tenantCode)

			// Invalidate entity list caches after creation
			if (entity && sanitizedData.entity_type_id) {
				try {
					// Use forms cache to store entity list data
					await cacheHelper.forms.delete(tenantCode, 'DEFAULT', 'entity_list', sanitizedData.entity_type_id)
					await cacheHelper.forms.delete(tenantCode, 'DEFAULT', 'entity_list_all', 'all_entities')
					console.log(`💾 Entity list cache invalidated after creation of entity ${entity.id}`)
				} catch (cacheError) {
					console.error(`❌ Failed to invalidate entity list cache after creation:`, cacheError)
				}
			}

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ENTITY_CREATED_SUCCESSFULLY',
				result: entity,
			})
		} catch (error) {
			if (error.message === 'ENTITY_TYPE_NOT_FOUND') {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Update entity.
	 * @method
	 * @name update
	 * @param {Object} bodyData - entity body data.
	 * @param {String} _id - entity id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @param {String} tenantCode - tenant code.
	 * @returns {JSON} - Entity updated response.
	 */

	static async update(bodyData, id, loggedInUserId, tenantCode) {
		// Create sanitized data object to avoid parameter mutation
		const sanitizedData = {
			...bodyData,
			updated_by: loggedInUserId,
		}
		const whereClause = {
			id: id,
			created_by: loggedInUserId,
		}
		try {
			const [updateCount, updatedEntity] = await entityTypeQueries.updateOneEntity(
				whereClause,
				tenantCode,
				sanitizedData,
				{
					returning: true,
					raw: true,
				}
			)

			if (updateCount === 0) {
				return responses.failureResponse({
					message: 'ENTITY_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Invalidate entity list caches after update
			if (updatedEntity && (updatedEntity.entity_type_id || sanitizedData.entity_type_id)) {
				const entityTypeId = updatedEntity.entity_type_id || sanitizedData.entity_type_id
				try {
					await cacheHelper.forms.delete(tenantCode, 'DEFAULT', 'entity_list', entityTypeId)
					await cacheHelper.forms.delete(tenantCode, 'DEFAULT', 'entity_list_all', 'all_entities')
					console.log(`💾 Entity list cache invalidated after update of entity ${id}`)
				} catch (cacheError) {
					console.error(`❌ Failed to invalidate entity list cache after update:`, cacheError)
				}
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ENTITY_UPDATED_SUCCESSFULLY',
				result: updatedEntity,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Read entity.
	 * @method
	 * @name read
	 * @param {Object} bodyData - entity body data.
	 * @param {String} userId - user id.
	 * @param {String} tenantCode - tenant code.
	 * @returns {JSON} - Entity read response.
	 */

	static async read(query, userId, tenantCode) {
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

			let filter
			if (query.id) {
				filter = {
					[Op.or]: [
						{
							id: query.id,
							created_by: '0',
							status: 'ACTIVE',
						},
						{ id: query.id, created_by: userId, status: 'ACTIVE' },
					],
					tenant_code: { [Op.in]: [tenantCode, defaults.tenantCode] },
				}
			} else {
				filter = {
					[Op.or]: [
						{
							value: query.value,
							created_by: '0',
							status: 'ACTIVE',
						},
						{ value: query.value, created_by: userId, status: 'ACTIVE' },
					],
					tenant_code: { [Op.in]: [tenantCode, defaults.tenantCode] },
				}
			}
			const entities = await entityTypeQueries.findAllEntities(filter, {
				[Op.in]: [tenantCode, defaults.tenantCode],
			})

			if (!entities.length) {
				return responses.failureResponse({
					message: 'ENTITY_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_FETCHED_SUCCESSFULLY',
				result: entities,
			})
		} catch (error) {
			throw error
		}
	}

	static async readAll(query, userId, tenantCode) {
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

			let filter
			if (query.read_user_entity == true) {
				filter = {
					[Op.or]: [
						{
							created_by: '0',
						},
						{
							created_by: userId,
						},
					],
					tenant_code: { [Op.in]: [tenantCode, defaults.tenantCode] },
				}
			} else {
				filter = {
					created_by: '0',
					tenant_code: { [Op.in]: [tenantCode, defaults.tenantCode] },
				}
			}
			const entities = await entityTypeQueries.findAllEntities(filter, {
				[Op.in]: [tenantCode, defaults.tenantCode],
			})

			if (!entities.length) {
				return responses.failureResponse({
					message: 'ENTITY_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_FETCHED_SUCCESSFULLY',
				result: entities,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Delete entity.
	 * @method
	 * @name delete
	 * @param {String} _id - Delete entity.
	 * @param {String} userId - user id.
	 * @param {String} tenantCode - tenant code.
	 * @returns {JSON} - Entity deleted response.
	 */

	static async delete(id, userId, tenantCode) {
		try {
			const whereClause = {
				id: id,
				created_by: userId,
				tenant_code: tenantCode,
			}
			const deleteCount = await entityTypeQueries.deleteOneEntityType(whereClause, tenantCode)
			if (deleteCount === '0') {
				return responses.failureResponse({
					message: 'ENTITY_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Invalidate entity list caches after deletion
			try {
				// Clear all entity list caches since we don't know the entity_type_id after deletion
				await cacheHelper.forms.delete(tenantCode, 'DEFAULT', 'entity_list_all', 'all_entities')
				console.log(`💾 Entity list cache invalidated after deletion of entity ${id}`)
			} catch (cacheError) {
				console.error(`❌ Failed to invalidate entity list cache after deletion:`, cacheError)
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ENTITY_DELETED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Get list of entity
	 * @method
	 * @name list
	 * @param {Object} query - query params
	 * @param {String} searchText - search label in entity.
	 * @param {Integer} pageNo -  page no.
	 * @param {Integer} pageSize -  page limit per api.
	 * @param {String} tenantCode - tenant code.
	 * @returns {JSON} - Entity search matched response.
	 */
	static async list(query, searchText, pageNo, pageSize, tenantCode) {
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

			let entityType = query.entity_type_id ? query.entity_type_id : ''
			let filter = {
				tenant_code: { [Op.in]: [tenantCode, defaults.tenantCode] },
			}
			if (entityType) {
				filter['entity_type_id'] = entityType
			}

			// Try to get entities from cache first (only cache paginated lists without search)
			const cacheKey = `${entityType || 'all'}_page${pageNo}_limit${pageSize}`
			let entities = null

			if (!searchText) {
				entities = await cacheHelper.forms.get(tenantCode, 'DEFAULT', 'entity_list', cacheKey)
				if (entities) {
					console.log(`💾 Entity list retrieved from cache for entityType: ${entityType || 'all'}`)
				}
			}

			if (!entities) {
				// Optimized: Get entities with entity_type details included - eliminates N+1 queries for clients
				entities = await entityTypeQueries.getAllEntitiesWithEntityTypeDetails(
					filter,
					{ [Op.in]: [defaults.tenantCode, tenantCode] },
					pageNo,
					pageSize,
					searchText
				)

				// Cache the result if no search text (searchable results shouldn't be cached)
				if (!searchText && entities) {
					try {
						await cacheHelper.forms.set(tenantCode, 'DEFAULT', 'entity_list', cacheKey, entities)
						console.log(`💾 Entity list cached for entityType: ${entityType || 'all'}`)
					} catch (cacheError) {
						console.error(`❌ Failed to cache entity list:`, cacheError)
					}
				}
			}

			if (entities.rows == 0 || entities.count == 0) {
				return responses.failureResponse({
					message: 'NO_RESULTS_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				const results = {
					data: entities.rows,
					count: entities.count,
				}

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'ENTITY_FETCHED_SUCCESSFULLY',
					result: results,
				})
			}
		} catch (error) {
			throw error
		}
	}
}
