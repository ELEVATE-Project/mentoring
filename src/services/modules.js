// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const modulesQueries = require('../database/queries/modules')
const permissionsQueries = require('../database/queries/permissions')
const { UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const { filter, constant, isNull } = require('lodash')

module.exports = class modulesHelper {
	/**
	 * Create modules.
	 * @method
	 * @name create
	 * @param {Object} bodyData - modules body data.
	 * @param {String} id -  id.
	 * @returns {JSON} - modules created response.
	 */

	static async create(bodyData) {
		try {
			const modules = await modulesQueries.createModules(bodyData)
			return common.successResponse({
				statusCode: httpStatusCode.created,
				message: 'MODULES_CREATED_SUCCESSFULLY',
				result: modules,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return common.failureResponse({
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

	static async update(id, bodyData) {
		try {
			const modules = await modulesQueries.findModulesById(id)
			if (!modules) {
				throw new Error('MODULES_NOT_FOUND')
			}
			const oldModuleCode = modules.code
			const updatedModules = await modulesQueries.updateModulesById(id, bodyData)
			const newModuleCode = updatedModules.code
			const updatePermissions = await permissionsQueries.updatePermissionsBasedOnModuleUpdate(
				oldModuleCode,
				newModuleCode
			)

			if (updatedModules === 'MODULES_NOT_UPDATED') {
				return common.failureResponse({
					message: 'MODULES_NOT_UPDATED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				return common.successResponse({
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

	static async delete(id) {
		try {
			const modules = await modulesQueries.findModulesById(id)

			if (!modules) {
				return common.failureResponse({
					message: 'MODULES_ALREADY_DELETED_OR_MODULE_NOT_PRESENT',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				const deletemodules = await modulesQueries.deleteModulesById(id)

				if (!deletemodules) {
					return common.failureResponse({
						message: 'MODULES_NOT_DELETED',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
				return common.successResponse({
					statusCode: httpStatusCode.accepted,
					message: 'MODULES_DELETED_SUCCESSFULLY',
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

	static async list(page, limit, search) {
		try {
			const modules = await modulesQueries.findAllModules(page, limit, search)

			if (modules.rows == 0 || modules.count == 0) {
				return common.failureResponse({
					message: 'MODULES_HAS_EMPTY_LIST',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				const result = {
					data: modules.rows,
					count: modules.count,
				}

				return common.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'MODULES_FETCHED_SUCCESSFULLY',
					result,
				})
			}
		} catch (error) {
			console.log
			throw error
		}
	}
}
