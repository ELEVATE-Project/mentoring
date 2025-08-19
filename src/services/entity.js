// Dependencies
const httpStatusCode = require('@generics/http-status')
const entityTypeQueries = require('../database/queries/entity')
const { UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const responses = require('@helpers/responses')
const { getDefaults } = require('@helpers/getDefaultOrgId')

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
			tenant_code: tenantCode,
		}
		try {
			const entity = await entityTypeQueries.createEntity(sanitizedData, tenantCode)
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ENTITY_CREATED_SUCCESSFULLY',
				result: entity,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			if (error instanceof ForeignKeyConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
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
			tenant_code: tenantCode,
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
			let filter
			if (query.id) {
				filter = {
					[Op.or]: [
						{
							id: query.id,
							created_by: '0',
							status: 'ACTIVE',
							tenant_code: tenantCode,
						},
						{ id: query.id, created_by: userId, status: 'ACTIVE', tenant_code: tenantCode },
					],
				}
			} else {
				filter = {
					[Op.or]: [
						{
							value: query.value,
							created_by: '0',
							status: 'ACTIVE',
							tenant_code: tenantCode,
						},
						{ value: query.value, created_by: userId, status: 'ACTIVE', tenant_code: tenantCode },
					],
				}
			}
			const entities = await entityTypeQueries.findAllEntities(filter, tenantCode)

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
			let filter
			if (query.read_user_entity == true) {
				filter = {
					[Op.or]: [
						{
							created_by: '0',
							tenant_code: tenantCode,
						},
						{
							created_by: userId,
							tenant_code: tenantCode,
						},
					],
				}
			} else {
				filter = {
					created_by: '0',
					tenant_code: tenantCode,
				}
			}
			const entities = await entityTypeQueries.findAllEntities(filter, tenantCode)

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
			let entityType = query.entity_type_id ? query.entity_type_id : ''
			let filter = {
				tenant_code: tenantCode,
			}
			if (entityType) {
				filter['entity_type_id'] = entityType
			}

			const attributes = ['id', 'entity_type_id', 'value', 'label', 'status', 'type', 'created_by', 'created_at']
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

			const entities = await entityTypeQueries.getAllEntities(
				filter,
				{ [Op.in]: [defaults.tenantCode, tenantCode] },
				attributes,
				pageNo,
				pageSize,
				searchText
			)

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
