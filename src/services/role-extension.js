const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const roleExtensionQueries = require('@database/queries/roleExtentions')

module.exports = class ReportsHelper {
	static async createRoleExtension(data, userId, organizationId, tenantCode) {
		try {
			// Attempt to create a new report directly
			const roleCreation = await roleExtensionQueries.createRoleExtension(
				data,
				userId,
				organizationId,
				tenantCode
			)
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ROLE_EXTENSION_CREATED_SUCCESS',
				result: roleCreation?.dataValues,
			})
		} catch (error) {
			// Handle unique constraint violation error
			if (error.name === 'SequelizeUniqueConstraintError') {
				return responses.failureResponse({
					message: 'ROLE_EXTENSION_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.failureResponse({
				message: 'ROLE_EXTENSION_CREATION_FAILED',
				statusCode: httpStatusCode.internalServerError,
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	static async roleExtensionDetails(title, userId, organizationId, tenantCode) {
		try {
			const readRoleExtension = await roleExtensionQueries.findRoleExtensionByTitle(title, tenantCode)
			if (!readRoleExtension) {
				return responses.failureResponse({
					message: 'ROLE_EXTENSION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ROLE_EXTENSION_FETCHED_SUCCESSFULLY',
				result: readRoleExtension.dataValues,
			})
		} catch (error) {
			throw error
		}
	}

	static async updateRoleExtension(title, updateData, userId, organizationId, tenantCode) {
		try {
			const filter = { title: title }
			const updatedRole = await roleExtensionQueries.updateRoleExtension(
				filter,
				updateData,
				userId,
				organizationId,
				tenantCode
			)
			if (!updatedRole) {
				return responses.failureResponse({
					message: 'ROLE_EXTENSION_UPDATE_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ROLE_EXTENSION_UPATED_SUCCESSFULLY',
				result: updatedRole.dataValues,
			})
		} catch (error) {
			throw error
		}
	}

	static async deleteRoleExtension(title, userId, organizationId, tenantCode) {
		try {
			const deletedRows = await roleExtensionQueries.deleteRoleExtension(title, tenantCode)
			if (deletedRows === 0) {
				return responses.failureResponse({
					message: 'ROLE_EXTENSION_DELETION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ROLE_EXTENSION_DELETED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}
}
