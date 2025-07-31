const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const reportTypeQueries = require('@database/queries/reportTypes')

module.exports = class ReportsHelper {
	static async createReportType(data, userId, organizationId, tenantCode) {
		try {
			// Attempt to create a new report directly
			const reportTypeCreation = await reportTypeQueries.createReportType(data, tenantCode)
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'REPORT_TYPE_CREATED_SUCCESS',
				result: reportTypeCreation?.dataValues,
			})
		} catch (error) {
			// Handle unique constraint violation error
			if (error.name === 'SequelizeUniqueConstraintError') {
				return responses.failureResponse({
					message: 'REPORT_TYPE_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.failureResponse({
				message: 'REPORT_TYPE_CREATION_FAILED',
				statusCode: httpStatusCode.internalServerError,
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	static async getReportType(title, organizationId, tenantCode) {
		try {
			const readReportType = await reportTypeQueries.findReportTypeByTitle(title, tenantCode)
			if (!readReportType) {
				return responses.failureResponse({
					message: 'REPORT_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'REPORT_TYPE_FETCHED_SUCCESSFULLY',
				result: readReportType.dataValues,
			})
		} catch (error) {
			throw error
		}
	}

	static async updateReportType(filter, updateData, userId, organizationId, tenantCode) {
		try {
			const updatedReport = await reportTypeQueries.updateReportType(filter, updateData, tenantCode)
			if (!updatedReport) {
				return responses.failureResponse({
					message: 'REPORT_TYPE_UPDATE_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'REPORT_TYPE_UPATED_SUCCESSFULLY',
				result: updatedReport.dataValues,
			})
		} catch (error) {
			throw error
		}
	}

	static async deleteReportType(id, userId, organizationId, tenantCode) {
		try {
			const deletedRows = await reportTypeQueries.deleteReportType(id, tenantCode)
			if (deletedRows === 0) {
				return responses.failureResponse({
					message: 'REPORT_TYPE_DELETION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'REPORT_TYPE_DELETED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}
}
