const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')

const utils = require('@generics/utils')
const kafkaCommunication = require('@generics/kafka-communication')
const notificationTemplateQueries = require('@database/queries/notificationTemplate')
const issueQueries = require('../database/queries/issue')
const userRequests = require('@requests/user')
const responses = require('@helpers/responses')
const cacheHelper = require('@generics/cacheHelper')
const { getDefaults } = require('@helpers/getDefaultOrgId')

const menteeExtensionQueries = require('@database/queries/userExtension')

module.exports = class issuesHelper {
	/**
	 * Report an issue.
	 * @method
	 * @name create
	 * @param {Object} bodyData - Reported issue body data.
	 * @param {String} decodedToken - Token information.
	 * @returns {JSON} - Success response.
	 */

	static async create(bodyData, decodedToken, tenantCode) {
		try {
			// Try cache first using logged-in user's organization context
			let userDetails = await cacheHelper.mentee.get(tenantCode, decodedToken.organization_code, decodedToken.id)
			if (!userDetails) {
				userDetails = await menteeExtensionQueries.getMenteeExtension(
					decodedToken.id,
					['name', 'user_id', 'email'],
					tenantCode
				)
				// Cache the result under logged-in user's organization context
				if (userDetails) {
					await cacheHelper.mentee.set(
						tenantCode,
						decodedToken.organization_code,
						decodedToken.id,
						userDetails
					)
				}
			}
			if (!userDetails) throw createUnauthorizedResponse('USER_NOT_FOUND')

			const name = userDetails.name
			const role = decodedToken.roles.some((role) => role.title === 'mentor') ? 'Mentor' : 'Mentee'
			const userEmailId = userDetails.email
			const email = process.env.SUPPORT_EMAIL_ID
			bodyData.user_id = decodedToken.id
			bodyData.tenant_code = tenantCode
			bodyData.organization_code = decodedToken.organization_code

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

			const tenantCodes = [tenantCode, defaults.tenantCode]
			const orgCodes = [decodedToken.organization_code, defaults.orgCode]

			// Get email template

			if (process.env.ENABLE_EMAIL_FOR_REPORT_ISSUE === 'true') {
				const templateData = await cacheHelper.notificationTemplates.get(
					tenantCodes,
					orgCodes,
					process.env.REPORT_ISSUE_EMAIL_TEMPLATE_CODE
				)

				let metaItems = ''
				if (bodyData.meta_data) {
					for (const [key, value] of Object.entries(bodyData.meta_data)) {
						metaItems += `<li><b>${utils.capitalize(key)}:</b> ${value}</li>\n`
					}
				}

				if (templateData) {
					const payload = {
						type: 'email',
						email: {
							to: email,
							replyTo: userEmailId,
							subject: templateData.subject,
							body: utils.composeEmailBody(templateData.body, {
								name,
								role,
								userEmailId,
								userId: bodyData.user_id.toString(),
								description: bodyData.description,
								metaItems: metaItems || 'Not available',
							}),
						},
					}
					await kafkaCommunication.pushEmailToKafka(payload)

					bodyData.isEmailTriggered = true
				}
			}
			await issueQueries.create(bodyData, tenantCode)

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ISSUE_REPORTED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}
}
