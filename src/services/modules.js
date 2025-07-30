// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const modulesQueries = require('@database/queries/modules')
const permissionsQueries = require('@database/queries/permissions')
const { UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const responses = require('@helpers/responses')

module.exports = class modulesHelper {
	/**
	 * Create modules.
	 * @method
	 * @name create
	 * @param {Object} bodyData - modules body data.
	 * @param {String} id -  id.
	 * @returns {JSON} - modules created response.
	 */

	static async create(bodyData, userId, organizationId, tenantCode) {
		try {
			// Add tenant context to bodyData
			bodyData.organization_code = organizationId
			bodyData.tenant_code = tenantCode

			const modules = await modulesQueries.createModules(bodyData, tenantCode)
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'MODULES_CREATED_SUCCESSFULLY',
				result: {
					Id: modules.id,
					code: modules.code,
					status: modules.status,
				},
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'MODULES_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Update modules.
	 * @method
	 * @name update
	 * @param {Object} bodyData - modules body data.
	 * @param {String} _id - modules id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @returns {JSON} - modules updated response.
	 */

	static async update(id, bodyData, userId, organizationId, tenantCode) {
		try {
			const modules = await modulesQueries.findModulesById(id, tenantCode)
			if (!modules) {
				throw new Error('MODULES_NOT_FOUND')
			}

			const updatedModules = await modulesQueries.updateModules(
				{ id, tenant_code: tenantCode },
				bodyData,
				tenantCode
			)
			const updatePermissions = permissionsQueries.updatePermissions(
				{ module: modules.code, tenant_code: tenantCode },
				{ module: updatedModules.code }
			)

			if (!updatedModules && !updatePermissions) {
				return responses.failureResponse({
					message: 'MODULES_NOT_UPDATED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				return responses.successResponse({
					statusCode: httpStatusCode.created,
					message: 'MODULES_UPDATED_SUCCESSFULLY',
					result: {
						id: updatedModules.id,
						status: updatedModules.status,
						code: updatedModules.code,
					},
				})
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * Delete modules.
	 * @method
	 * @name delete
	 * @param {String} _id - Delete modules.
	 * @returns {JSON} - modules deleted response.
	 */

	static async delete(id, userId, organizationId, tenantCode) {
		try {
			const modules = await modulesQueries.findModulesById(id, tenantCode)

			if (!modules) {
				return responses.failureResponse({
					message: 'MODULES_ALREADY_DELETED_OR_MODULE_NOT_PRESENT',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				const deletemodules = await modulesQueries.deleteModulesById(id, tenantCode)

				if (!deletemodules) {
					return responses.failureResponse({
						message: 'MODULES_NOT_DELETED',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
				return responses.successResponse({
					statusCode: httpStatusCode.accepted,
					message: 'MODULES_DELETED_SUCCESSFULLY',
					result: {},
				})
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * list modules.
	 * @method
	 * @name list
	 * @param {String} id -  id.
	 * @returns {JSON} - modules list response.
	 */

	static async list(page, limit, search, userId, organizationId, tenantCode) {
		try {
			const offset = common.getPaginationOffset(page, limit)

			const filter = {
				code: { [Op.iLike]: `%${search}%` },
				tenant_code: tenantCode,
			}
			const options = {
				offset,
				limit,
			}
			const attributes = ['id', 'code', 'status']
			const modules = await modulesQueries.findAllModules(filter, attributes, options, tenantCode)

			if (modules.rows == 0 || modules.count == 0) {
				return responses.failureResponse({
					message: 'MODULES_HAS_EMPTY_LIST',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				const results = {
					data: modules.rows,
					count: modules.count,
				}

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'MODULES_FETCHED_SUCCESSFULLY',
					result: results,
				})
			}
		} catch (error) {
			throw error
		}
	}
}
