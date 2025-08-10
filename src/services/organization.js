'use strict'
const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const questionSetQueries = require('../database/queries/question-set')
const { Op } = require('sequelize')
const { eventListenerRouter } = require('@helpers/eventListnerRouter')
const responses = require('@helpers/responses')

module.exports = class OrganizationService {
	static async update(bodyData, decodedToken, tenantCode) {
		try {
			const questionSets = await questionSetQueries.findQuestionSets(
				{
					code: { [Op.in]: [bodyData.mentee_feedback_question_set, bodyData.mentor_feedback_question_set] },
					tenant_code: tenantCode,
				},
				['id', 'code'],
				tenantCode
			)
			if (
				questionSets.length === 0 ||
				(questionSets.length === 1 &&
					bodyData.mentee_feedback_question_set !== bodyData.mentor_feedback_question_set)
			) {
				return responses.failureResponse({
					message: 'QUESTIONS_SET_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			const extensionData = {
				organization_id: decodedToken.organization_id,
				organization_code: decodedToken.organization_code,
				tenant_code: tenantCode,
				mentee_feedback_question_set: bodyData.mentee_feedback_question_set,
				mentor_feedback_question_set: bodyData.mentor_feedback_question_set,
				updated_by: decodedToken.id,
			}
			const orgExtension = await organisationExtensionQueries.upsert(extensionData)
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ORG_DEFAULT_QUESTION_SETS_SET_SUCCESSFULLY',
				result: {
					organization_id: orgExtension.organization_id,
					mentee_feedback_question_set: orgExtension.mentee_feedback_question_set,
					mentor_feedback_question_set: orgExtension.mentor_feedback_question_set,
					updated_by: orgExtension.updated_by,
				},
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	static async createOrgExtension(eventBody, tenantCode) {
		try {
			console.log('EVENT BODY: ', eventBody)
			console.log('DEFAULT ORGANISATION POLICY: ', common.getDefaultOrgPolicies())
			const extensionData = {
				...common.getDefaultOrgPolicies(),
				organization_id: eventBody.entityId,
				organization_code: eventBody.organization_code || eventBody.entityId,
				created_by: eventBody.created_by,
				updated_by: eventBody.created_by,
				name: eventBody.name,
				tenant_code: tenantCode,
			}
			console.log('EXTENSION DATA BEFORE INSERT: ', extensionData)
			const orgExtension = await organisationExtensionQueries.upsert(extensionData)
			console.log('EXTENSION DATA AFTER INSERT: ', orgExtension)
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ORG_EXTENSION_CREATED_SUCCESSFULLY',
				result: {
					organization_id: orgExtension.organization_id,
				},
			})
		} catch (error) {
			if (error.name === 'SequelizeUniqueConstraintError')
				throw new Error(`Extension Already Exist For Organization With Id: ${eventBody.entityId}`)
			else throw error
		}
	}

	static async eventListener(eventBody) {
		try {
			//EventBody Validation - TODO: Check if this should be a middleware
			/* const { entity, eventType, entityId } = eventBody
			if (!entity || !eventType || !entityId)
				throw new Error('Entity, EventType & EntityId values are mandatory for an Event')
			return await eventListenerRouter(eventBody, {
				createFn: this.createOrgExtension,
			}) */
			return this.createOrgExtension(eventBody)
		} catch (error) {
			console.log(error)
			return error
		}
	}
}
