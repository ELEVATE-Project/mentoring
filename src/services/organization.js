'use strict'
const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const questionSetQueries = require('../database/queries/question-set')
const { Op } = require('sequelize')
const { eventListenerRouter } = require('@helpers/eventListnerRouter')
const responses = require('@helpers/responses')
const cacheHelper = require('@generics/cacheHelper')
const { getDefaults } = require('@helpers/getDefaultOrgId')

module.exports = class OrganizationService {
	static async update(bodyData, decodedToken, tenantCode) {
		try {
			const questionSets = await questionSetQueries.findQuestionSets(
				{
					code: { [Op.in]: [bodyData.mentee_feedback_question_set, bodyData.mentor_feedback_question_set] },
					tenant_code: tenantCode,
				},
				['id', 'code']
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
			const orgExtension = await organisationExtensionQueries.upsert(extensionData, tenantCode)

			// Invalidate organization extension caches after successful update
			await this._invalidateOrganizationExtensionCaches({
				tenantCode,
				orgCode: decodedToken.organization_code,
			})

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
			const orgExtension = await organisationExtensionQueries.upsert(extensionData, tenantCode)
			console.log('EXTENSION DATA AFTER INSERT: ', orgExtension)

			// Invalidate organization extension caches after successful creation
			await this._invalidateOrganizationExtensionCaches({
				tenantCode,
				orgCode: extensionData.organization_code,
			})

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

	/**
	 * Get organization extension by ID with caching (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @method
	 * @name getByIdCached
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Object} - Cached organization extension data
	 */
	static async getByIdCached(orgCode, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode || !defaults.tenantCode) {
				throw new Error('DEFAULT_ORG_CODE_OR_TENANT_CODE_NOT_SET')
			}

			// Create cache ID based on parameters to ensure cache uniqueness
			const cacheId = `org_extension:${orgCode}:${tenantCode}`

			let orgExtension
			try {
				orgExtension = await cacheHelper.getOrSet({
					tenantCode,
					orgCode: orgCode || defaults.orgCode,
					ns: common.CACHE_CONFIG.namespaces.organization_extensions.name,
					id: cacheId,
					fetchFn: async () => {
						return await organisationExtensionQueries.getById(orgCode, tenantCode)
					},
				})
			} catch (cacheError) {
				console.warn(
					'Cache system failed for organization extension, falling back to database:',
					cacheError.message
				)
				orgExtension = await organisationExtensionQueries.getById(orgCode, tenantCode)
			}

			return orgExtension
		} catch (error) {
			throw error
		}
	}

	/**
	 * Find one organization extension with caching (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @method
	 * @name findOneCached
	 * @param {Object} filter - Filter criteria
	 * @param {String} tenantCode - Tenant code
	 * @param {Object} options - Query options
	 * @returns {Object} - Cached organization extension data
	 */
	static async findOneCached(filter, tenantCode, options = {}) {
		try {
			// Create cache ID based on all parameters to ensure cache uniqueness
			const cacheId = `org_ext_one:${JSON.stringify({ filter, options })}`

			let orgExtension
			try {
				orgExtension = await cacheHelper.getOrSet({
					tenantCode,
					orgCode: filter.organization_code || 'default',
					ns: common.CACHE_CONFIG.namespaces.organization_extensions.name,
					id: cacheId,
					fetchFn: async () => {
						return await organisationExtensionQueries.findOne(filter, tenantCode, options)
					},
				})
			} catch (cacheError) {
				console.warn(
					'Cache system failed for organization extension findOne, falling back to database:',
					cacheError.message
				)
				orgExtension = await organisationExtensionQueries.findOne(filter, tenantCode, options)
			}

			return orgExtension
		} catch (error) {
			throw error
		}
	}

	/**
	 * Find all organization extensions with caching (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @method
	 * @name findAllCached
	 * @param {Object} filter - Filter criteria
	 * @param {Object} options - Query options
	 * @returns {Array} - Cached organization extensions data
	 */
	static async findAllCached(filter, options = {}) {
		try {
			// Create cache ID based on all parameters to ensure cache uniqueness
			const cacheId = `org_ext_all:${JSON.stringify({ filter, options })}`

			let orgExtensions
			try {
				orgExtensions = await cacheHelper.getOrSet({
					tenantCode: filter.tenant_code || 'default',
					orgCode: filter.organization_code || 'default',
					ns: common.CACHE_CONFIG.namespaces.organization_extensions.name,
					id: cacheId,
					fetchFn: async () => {
						return await organisationExtensionQueries.findAll(filter, options)
					},
				})
			} catch (cacheError) {
				console.warn(
					'Cache system failed for organization extensions findAll, falling back to database:',
					cacheError.message
				)
				orgExtensions = await organisationExtensionQueries.findAll(filter, options)
			}

			return orgExtensions
		} catch (error) {
			throw error
		}
	}

	/**
	 * Find or insert organization extension with caching (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @method
	 * @name findOrInsertOrganizationExtensionCached
	 * @param {String} organizationId - Organization ID
	 * @param {String} organizationCode - Organization code
	 * @param {String} organization_name - Organization name
	 * @param {String} tenantCode - Tenant code
	 * @returns {Object} - Cached organization extension data
	 */
	static async findOrInsertOrganizationExtensionCached(
		organizationId,
		organizationCode,
		organization_name,
		tenantCode
	) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode || !defaults.tenantCode) {
				throw new Error('DEFAULT_ORG_CODE_OR_TENANT_CODE_NOT_SET')
			}

			// Create cache ID based on parameters to ensure cache uniqueness
			const cacheId = `org_ext_find_insert:${organizationId}:${organizationCode}:${tenantCode}`

			let orgExtension
			try {
				orgExtension = await cacheHelper.getOrSet({
					tenantCode,
					orgCode: organizationCode || defaults.orgCode,
					ns: common.CACHE_CONFIG.namespaces.organization_extensions.name,
					id: cacheId,
					fetchFn: async () => {
						return await organisationExtensionQueries.findOrInsertOrganizationExtension(
							organizationId,
							organizationCode,
							organization_name,
							tenantCode
						)
					},
				})
			} catch (cacheError) {
				console.warn(
					'Cache system failed for organization extension findOrInsert, falling back to database:',
					cacheError.message
				)
				orgExtension = await organisationExtensionQueries.findOrInsertOrganizationExtension(
					organizationId,
					organizationCode,
					organization_name,
					tenantCode
				)
			}

			return orgExtension
		} catch (error) {
			throw error
		}
	}

	/**
	 * Invalidate organization extension related caches after CUD operations
	 * Following the user service pattern for organization extension cache invalidation
	 */
	static async _invalidateOrganizationExtensionCaches({ tenantCode, orgCode }) {
		try {
			// Evict organization_extensions namespace
			await cacheHelper.evictNamespace({
				tenantCode,
				orgCode: orgCode,
				ns: common.CACHE_CONFIG.namespaces.organization_extensions.name,
			})

			// Special handling for default org - invalidate all orgs (similar to user service pattern)
			const defaults = await getDefaults()
			if (defaults.orgCode === orgCode) {
				await cacheHelper.evictTenantByPattern(tenantCode, {
					patternSuffix: `org:*:${common.CACHE_CONFIG.namespaces.organization_extensions.name}:*`,
				})
			}
		} catch (err) {
			console.error('Organization extension cache invalidation failed', err)
			// Don't throw - cache failures should not block main operations
		}
	}
}
