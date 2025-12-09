const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const ReportQueries = require('@database/queries/reportQueries')

module.exports = class ReportsHelper {
	static async createQuery(data) {
		try {
			// Attempt to create a new report directly
			const mappingCreation = await ReportQueries.createReportQuery(data)
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'REPORT_QUERY_CREATED_SUCCESSFULLY',
				result: mappingCreation?.dataValues,
			})
		} catch (error) {
			if (error.name === 'SequelizeUniqueConstraintError') {
				return responses.failureResponse({
					message: 'REPORT_QUERY_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.failureResponse({
				message: 'REPORT_QUERY_CREATION_FAILED',
				statusCode: httpStatusCode.internalServerError,
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	static async getQuery(code) {
		try {
			const readQuery = await ReportQueries.findReportQueryByCode(code)
			if (!readQuery) {
				return responses.failureResponse({
					message: 'REPORT_QUERY_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'REPORT_QUERY_FETCHED_SUCCESSFULLY',
				result: readQuery,
			})
		} catch (error) {
			throw error
		}
	}

	static async updateQuery(code, updateData) {
		try {
			const filter = { report_code: code }
			const updateMapping = await ReportQueries.updateReportQueries(filter, updateData)
			if (!updateMapping) {
				return responses.failureResponse({
					message: 'REPORT_QUERY_UPDATE_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'REPORT_QUERY_UPATED_SUCCESSFULLY',
				result: updateMapping.dataValues,
			})
		} catch (error) {
			throw error
		}
	}

	static async deleteQuery(id) {
		try {
			const deletedRows = await ReportQueries.deleteReportQueryById(id)
			if (deletedRows === 0) {
				return responses.failureResponse({
					message: 'REPORT_QUERY_DELETION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'REPORT_QUERY_DELETED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}
}
