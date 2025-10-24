/**
 * Centralized Cache Helper
 *
 * This helper centralizes all caching logic to provide a unified caching interface
 * for all services. It prevents circular dependencies and provides consistent
 * caching patterns across the application.
 *
 * Architecture:
 * - Only imports query files and core dependencies (no other services)
 * - Provides cached versions of common data access patterns
 * - Prevents circular dependencies: Service → cacheHelper → queries
 * - Unified cache invalidation and management
 */

const cacheHelper = require('@generics/cacheHelper')
const menteeQueries = require('@database/queries/userExtension')
const mentorQueries = require('@database/queries/mentorExtension')
const entityTypeQueries = require('@database/queries/entityType')
const organizationQueries = require('@database/queries/organisationExtension')
const organizationExtensionQueries = require('@database/queries/organisationExtension')
const notificationQueries = require('@database/queries/notificationTemplate')
const permissionQueries = require('@database/queries/permissions')
const rolePermissionMappingQueries = require('@database/queries/role-permission-mapping')
const formQueries = require('@database/queries/form')
const sessionQueries = require('@database/queries/sessions')
const sessionAttendeesQueries = require('@database/queries/sessionAttendees')
const connectionQueries = require('@database/queries/connection')
const entityQueries = require('@database/queries/entity')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const utils = require('@generics/utils')
const { Op } = require('sequelize')

module.exports = class CacheHelper {
	/**
	 * Get mentee extension details by user ID with caching.
	 * @param {String} userId - User ID of the mentee
	 * @param {Array} attributes - Attributes to select (default: [])
	 * @param {Boolean} unScoped - Whether to use unscoped query (default: false)
	 * @param {String} tenantCode - Tenant code for isolation
	 * @returns {Promise<Object>} - Cached mentee extension details
	 */
	static async getMenteeExtensionCached(userId, attributes = [], unScoped = false, tenantCode) {
		try {
			// Get user's organization for cache key structure
			const userExtension = await menteeQueries.getMenteeExtension(
				userId,
				['organization_code'],
				unScoped,
				tenantCode
			)

			if (!userExtension) {
				return null
			}

			const orgCode = userExtension.organization_code || process.env.DEFAULT_ORGANISATION_CODE
			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:mentee:${userId}`
			const ttl = 300 // 5 minutes TTL

			// Try to get from cache first
			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			// Fallback to database query with requested attributes
			const menteeDetails = await menteeQueries.getMenteeExtension(userId, attributes, unScoped, tenantCode)

			// Cache the result
			if (menteeDetails) {
				try {
					await cacheHelper.set(cacheKey, menteeDetails, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache mentee extension:', cacheErr.message)
				}
			}

			return menteeDetails
		} catch (error) {
			console.warn('Error in getMenteeExtensionCached, falling back to database:', error.message)
			return await menteeQueries.getMenteeExtension(userId, attributes, unScoped, tenantCode)
		}
	}

	/**
	 * Get mentor extension details by user ID with caching.
	 * @param {String} userId - User ID of the mentor
	 * @param {Array} attributes - Attributes to select (default: [])
	 * @param {Boolean} unScoped - Whether to use unscoped query (default: false)
	 * @param {String} tenantCode - Tenant code for isolation
	 * @returns {Promise<Object>} - Cached mentor extension details
	 */
	static async getMentorExtensionCached(userId, attributes = [], unScoped = false, tenantCode) {
		try {
			// Get mentor's organization for cache key structure
			const mentorExtension = await mentorQueries.getMentorExtension(
				userId,
				['organization_code'],
				unScoped,
				tenantCode
			)

			if (!mentorExtension) {
				return null
			}

			const orgCode = mentorExtension.organization_code || process.env.DEFAULT_ORGANISATION_CODE
			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:mentor:${userId}`
			const ttl = 300 // 5 minutes TTL

			// Try to get from cache first
			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			// Fallback to database query with requested attributes
			const mentorDetails = await mentorQueries.getMentorExtension(userId, attributes, unScoped, tenantCode)

			// Cache the result
			if (mentorDetails) {
				try {
					await cacheHelper.set(cacheKey, mentorDetails, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache mentor extension:', cacheErr.message)
				}
			}

			return mentorDetails
		} catch (error) {
			console.warn('Error in getMentorExtensionCached, falling back to database:', error.message)
			return await mentorQueries.getMentorExtension(userId, attributes, unScoped, tenantCode)
		}
	}

	/**
	 * Get users by user IDs with caching for bulk operations.
	 * @param {Array} ids - Array of user IDs
	 * @param {Object} options - Query options (default: {})
	 * @param {String} tenantCode - Tenant code for isolation
	 * @param {Boolean} unscoped - Whether to use unscoped query (default: false)
	 * @returns {Promise<Array>} - Cached users data
	 */
	static async getUsersByUserIdsCached(ids, options = {}, tenantCode, unscoped = false) {
		if (ids.length === 0) return []

		try {
			// Get organization code for cache structure - fetch from one of the users if needed
			let orgCode = process.env.DEFAULT_ORGANISATION_CODE
			const ttl = 300 // 5 minutes TTL

			const cachedResults = []
			const uncachedIds = []

			// Check cache for each user individually
			for (const userId of ids) {
				const cacheKey = `tenant:${tenantCode}:org:${orgCode}:mentee:${userId}`
				const cached = await cacheHelper.get(cacheKey)
				if (cached) {
					cachedResults.push(cached)
				} else {
					uncachedIds.push(userId)
				}
			}

			// Fetch uncached users from database
			let dbResults = []
			if (uncachedIds.length > 0) {
				dbResults = await menteeQueries.getUsersByUserIds(uncachedIds, options, tenantCode, unscoped)

				// Cache individual users
				for (const user of dbResults) {
					try {
						const userOrgCode = user.organization_code || orgCode
						const cacheKey = `tenant:${tenantCode}:org:${userOrgCode}:mentee:${user.user_id}`
						await cacheHelper.set(cacheKey, user, ttl)
					} catch (cacheErr) {
						console.warn('Failed to cache individual user:', cacheErr.message)
					}
				}
			}

			return [...cachedResults, ...dbResults]
		} catch (cacheError) {
			console.warn('Cache system failed for bulk users, falling back to database:', cacheError.message)
			return await menteeQueries.getUsersByUserIds(ids, options, tenantCode, unscoped)
		}
	}

	/**
	 * Get all users by organization IDs with caching.
	 * @param {Array} orgIds - Array of organization IDs
	 * @param {String} tenantCode - Tenant code for isolation
	 * @returns {Promise<Array>} - Cached users data by organization
	 */
	static async getAllUsersByOrgIdCached(orgIds, tenantCode) {
		if (!Array.isArray(orgIds) || orgIds.length === 0) {
			return []
		}

		try {
			const cacheKey = `tenant:${tenantCode}:org:all:users-by-org:${orgIds.sort().join(',')}`
			const ttl = 300 // 5 minutes TTL

			// Try to get from cache first
			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			// Fallback to database query
			const users = await menteeQueries.getAllUsersByOrgId(orgIds, tenantCode)

			// Cache the result
			try {
				await cacheHelper.set(cacheKey, users, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache users by organization:', cacheErr.message)
			}

			return users
		} catch (cacheError) {
			console.warn('Cache system failed for users by organization, falling back to database:', cacheError.message)
			return await menteeQueries.getAllUsersByOrgId(orgIds, tenantCode)
		}
	}

	/**
	 * Find one entity type with caching.
	 * @param {Object} filter - Filter criteria
	 * @param {Object} tenantCodes - Tenant codes filter
	 * @returns {Promise<Object>} - Cached entity type
	 */
	static async findOneEntityTypeCached(filter, tenantCodes) {
		try {
			const cacheKey = `entity_type_one:${JSON.stringify(filter)}:${JSON.stringify(tenantCodes)}`
			const ttl = 300 // 5 minutes TTL for entity types

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const entityType = await entityTypeQueries.findOneEntityType(filter, tenantCodes)

			if (entityType) {
				try {
					await cacheHelper.set(cacheKey, entityType, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache entity type:', cacheErr.message)
				}
			}

			return entityType
		} catch (error) {
			console.warn('Error in findOneEntityTypeCached, falling back to database:', error.message)
			return await entityTypeQueries.findOneEntityType(filter, tenantCodes)
		}
	}

	/**
	 * Get all entity types with caching.
	 * @param {Array|Object} orgCodes - Organization codes
	 * @param {Array|Object} tenantCodes - Tenant codes
	 * @param {Array} attributes - Attributes to select
	 * @param {Object} filter - Additional filter criteria
	 * @returns {Array} - Cached entity types
	 */
	static async readAllEntityTypesCached(orgCodes, tenantCodes, attributes, filter = {}) {
		try {
			// Create tenant and org based cache key for all entity types
			const tenantCode = Array.isArray(tenantCodes) ? tenantCodes[0] : tenantCodes
			const orgCode = Array.isArray(orgCodes) ? orgCodes[0] : orgCodes
			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:entity_types:all_types`
			const ttl = 300 // 5 minutes TTL

			// Try to get from cache first
			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			// Fallback to database query
			const entityTypes = await entityTypeQueries.findAllEntityTypes(orgCodes, tenantCodes, attributes, filter)

			// Cache the result
			try {
				await cacheHelper.set(cacheKey, entityTypes, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache entity types:', cacheErr.message)
			}

			return entityTypes
		} catch (cacheError) {
			console.warn('Cache system failed for entity types, falling back to database:', cacheError.message)
			return await entityTypeQueries.findAllEntityTypes(orgCodes, tenantCodes, attributes, filter)
		}
	}

	/**
	 * Get organization by ID with caching.
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Object>} - Cached organization details
	 */
	static async getOrganizationByIdCached(orgCode, tenantCode) {
		try {
			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:organization:details`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const organization = await organizationQueries.findOne({ organization_code: orgCode }, tenantCode)

			if (organization) {
				try {
					await cacheHelper.set(cacheKey, organization, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache organization:', cacheErr.message)
				}
			}

			return organization
		} catch (error) {
			console.warn('Error in getOrganizationByIdCached, falling back to database:', error.message)
			return await organizationQueries.findOne({ organization_code: orgCode }, tenantCode)
		}
	}

	/**
	 * Find or insert organization extension with caching.
	 * @param {String} organizationId - Organization ID
	 * @param {String} organizationCode - Organization code
	 * @param {String} organizationName - Organization name
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Object>} - Cached organization extension
	 */
	static async findOrInsertOrganizationExtensionCached(
		organizationId,
		organizationCode,
		organizationName,
		tenantCode
	) {
		try {
			const cacheKey = `tenant:${tenantCode}:org:${organizationCode}:org_extension:${organizationId}`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const orgExtension = await organizationExtensionQueries.findOrInsertOrganizationExtension(
				organizationId,
				organizationCode,
				organizationName,
				tenantCode
			)

			if (orgExtension) {
				try {
					await cacheHelper.set(cacheKey, orgExtension, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache organization extension:', cacheErr.message)
				}
			}

			return orgExtension
		} catch (error) {
			console.warn('Error in findOrInsertOrganizationExtensionCached, falling back to database:', error.message)
			return await organizationExtensionQueries.findOrInsertOrganizationExtension(
				organizationId,
				organizationCode,
				organizationName,
				tenantCode
			)
		}
	}

	/**
	 * Find one email template with caching.
	 * @param {String} code - Template code
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Object>} - Cached email template
	 */
	static async findOneEmailTemplateCached(code, orgCode, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode || !defaults.tenantCode) {
				throw new Error('DEFAULT_ORG_CODE_OR_TENANT_CODE_NOT_SET')
			}

			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:email_template:${code}`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const template = await notificationQueries.findOneEmailTemplate(code, orgCode, tenantCode)

			if (template) {
				try {
					await cacheHelper.set(cacheKey, template, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache email template:', cacheErr.message)
				}
			}

			return template
		} catch (error) {
			console.warn('Error in findOneEmailTemplateCached, falling back to database:', error.message)
			return await notificationQueries.findOneEmailTemplate(code, orgCode, tenantCode)
		}
	}

	/**
	 * Get upcoming sessions of mentee with caching.
	 * @param {String} userId - User ID
	 * @param {String} sessionType - Session type (private/public)
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Array>} - Cached upcoming sessions of mentee
	 */
	static async getUpcomingSessionsOfMenteeCached(userId, sessionType, tenantCode) {
		try {
			const cacheKey = `tenant:${tenantCode}:upcoming_sessions_mentee:${userId}:${sessionType}`
			const ttl = 60 // 1 minute TTL for upcoming sessions

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const sessions = await sessionQueries.getUpcomingSessionsOfMentee(userId, sessionType, tenantCode)

			if (sessions) {
				try {
					await cacheHelper.set(cacheKey, sessions, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache upcoming sessions of mentee:', cacheErr.message)
				}
			}

			return sessions
		} catch (error) {
			console.warn('Error in getUpcomingSessionsOfMenteeCached, falling back to database:', error.message)
			return await sessionQueries.getUpcomingSessionsOfMentee(userId, sessionType, tenantCode)
		}
	}

	/**
	 * Get upcoming sessions for mentor with caching.
	 * @param {String} mentorUserId - Mentor User ID
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Array>} - Cached upcoming sessions for mentor
	 */
	static async getUpcomingSessionsForMentorCached(mentorUserId, tenantCode) {
		try {
			const cacheKey = `tenant:${tenantCode}:upcoming_sessions_mentor:${mentorUserId}`
			const ttl = 60 // 1 minute TTL for upcoming sessions

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const sessions = await sessionQueries.getUpcomingSessionsForMentor(mentorUserId, tenantCode)

			if (sessions) {
				try {
					await cacheHelper.set(cacheKey, sessions, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache upcoming sessions for mentor:', cacheErr.message)
				}
			}

			return sessions
		} catch (error) {
			console.warn('Error in getUpcomingSessionsForMentorCached, falling back to database:', error.message)
			return await sessionQueries.getUpcomingSessionsForMentor(mentorUserId, tenantCode)
		}
	}

	/**
	 * Get all upcoming sessions with caching.
	 * @param {Boolean} isPublic - Whether to get public sessions only
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Array>} - Cached all upcoming sessions
	 */
	static async getAllUpcomingSessionsCached(isPublic, tenantCode) {
		try {
			const cacheKey = `tenant:${tenantCode}:all_upcoming_sessions:${isPublic ? 'public' : 'all'}`
			const ttl = 60 // 1 minute TTL for upcoming sessions

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const sessions = await sessionQueries.getAllUpcomingSessions(isPublic, tenantCode)

			if (sessions) {
				try {
					await cacheHelper.set(cacheKey, sessions, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache all upcoming sessions:', cacheErr.message)
				}
			}

			return sessions
		} catch (error) {
			console.warn('Error in getAllUpcomingSessionsCached, falling back to database:', error.message)
			return await sessionQueries.getAllUpcomingSessions(isPublic, tenantCode)
		}
	}

	/**
	 * Get mentors by user IDs with caching for bulk operations.
	 * @param {Array} userIds - Array of user IDs
	 * @param {Object} options - Query options
	 * @param {String} tenantCode - Tenant code
	 * @param {Boolean} unscoped - Whether to use unscoped query
	 * @returns {Promise<Array>} - Cached mentors by user IDs
	 */
	static async getMentorsByUserIdsCached(userIds, options = {}, tenantCode, unscoped = false) {
		try {
			if (!userIds || userIds.length === 0) {
				return []
			}

			const cacheKey = `tenant:${tenantCode}:mentors_by_ids:${userIds.slice(0, 5).join('_')}:${unscoped}`
			const ttl = 300 // 5 minutes TTL for mentor data

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const mentors = await mentorQueries.getMentorsByUserIds(userIds, options, tenantCode, unscoped)

			if (mentors) {
				try {
					await cacheHelper.set(cacheKey, mentors, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache mentors by user IDs:', cacheErr.message)
				}
			}

			return mentors
		} catch (error) {
			console.warn('Error in getMentorsByUserIdsCached, falling back to database:', error.message)
			return await mentorQueries.getMentorsByUserIds(userIds, options, tenantCode, unscoped)
		}
	}

	/**
	 * Get mentors upcoming sessions from view with caching.
	 * @param {Number} page - Page number
	 * @param {Number} limit - Page size
	 * @param {String} search - Search text
	 * @param {Object} filters - Filter criteria
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Object>} - Cached mentors upcoming sessions
	 */
	static async getMentorsUpcomingSessionsFromViewCached(page, limit, search, filters, tenantCode) {
		try {
			const cacheKey = `tenant:${tenantCode}:mentors_upcoming_sessions:${page}:${limit}:${search}:${JSON.stringify(
				filters
			)}`
			const ttl = 60 // 1 minute TTL for upcoming sessions

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const sessions = await sessionQueries.getMentorsUpcomingSessionsFromView(
				page,
				limit,
				search,
				filters,
				tenantCode
			)

			if (sessions) {
				try {
					await cacheHelper.set(cacheKey, sessions, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache mentors upcoming sessions from view:', cacheErr.message)
				}
			}

			return sessions
		} catch (error) {
			console.warn('Error in getMentorsUpcomingSessionsFromViewCached, falling back to database:', error.message)
			return await sessionQueries.getMentorsUpcomingSessionsFromView(page, limit, search, filters, tenantCode)
		}
	}

	/**
	 * Get mentors by user IDs from view with caching.
	 * @param {Number} page - Page number
	 * @param {Number} limit - Page size
	 * @param {Object} filters - Filter criteria
	 * @param {String} search - Search text
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Object>} - Cached mentors from view
	 */
	static async getMentorsByUserIdsFromViewCached(page, limit, filters, search, tenantCode) {
		try {
			const cacheKey = `tenant:${tenantCode}:mentors_from_view:${page}:${limit}:${search}:${JSON.stringify(
				filters
			)}`
			const ttl = 300 // 5 minutes TTL for mentor view data

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const mentors = await mentorQueries.getMentorsByUserIdsFromView(page, limit, filters, search, tenantCode)

			if (mentors) {
				try {
					await cacheHelper.set(cacheKey, mentors, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache mentors by user IDs from view:', cacheErr.message)
				}
			}

			return mentors
		} catch (error) {
			console.warn('Error in getMentorsByUserIdsFromViewCached, falling back to database:', error.message)
			return await mentorQueries.getMentorsByUserIdsFromView(page, limit, filters, search, tenantCode)
		}
	}

	/**
	 * Find all session attendees with caching.
	 * @param {Object} filter - Filter criteria
	 * @param {Array} attributes - Attributes to select
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Array>} - Cached session attendees
	 */
	static async findAllSessionAttendeesCached(filter, attributes, tenantCode) {
		try {
			const cacheKey = `tenant:${tenantCode}:session_attendees:all:${JSON.stringify(filter)}`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const attendees = await sessionAttendeesQueries.findAll(filter, tenantCode, { attributes })

			if (attendees) {
				try {
					await cacheHelper.set(cacheKey, attendees, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache session attendees:', cacheErr.message)
				}
			}

			return attendees
		} catch (error) {
			console.warn('Error in findAllSessionAttendeesCached, falling back to database:', error.message)
			return await sessionAttendeesQueries.findAll(filter, tenantCode, { attributes })
		}
	}

	/**
	 * Get connections count with caching.
	 * @param {String} userId - User ID
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Number>} - Cached connections count
	 */
	static async getConnectionsCountCached(userId, tenantCode) {
		try {
			const cacheKey = `tenant:${tenantCode}:connections_count:${userId}`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached !== null && cached !== undefined) {
				return cached
			}

			const count = await connectionQueries.getConnectionsCount(userId, tenantCode)

			try {
				await cacheHelper.set(cacheKey, count, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache connections count:', cacheErr.message)
			}

			return count
		} catch (error) {
			console.warn('Error in getConnectionsCountCached, falling back to database:', error.message)
			return await connectionQueries.getConnectionsCount(userId, tenantCode)
		}
	}

	/**
	 * Get connected users with caching.
	 * @param {String} userId - User ID
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Array>} - Cached connected users
	 */
	static async getConnectedUsersCached(userId, tenantCode) {
		try {
			const cacheKey = `tenant:${tenantCode}:connected_users:${userId}`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const users = await connectionQueries.getConnectedUsers(userId, tenantCode)

			if (users) {
				try {
					await cacheHelper.set(cacheKey, users, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache connected users:', cacheErr.message)
				}
			}

			return users
		} catch (error) {
			console.warn('Error in getConnectedUsersCached, falling back to database:', error.message)
			return await connectionQueries.getConnectedUsers(userId, tenantCode)
		}
	}

	/**
	 * Read user entity types and entities with caching.
	 * @param {Object} filter - Filter criteria
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Array>} - Cached entity types with entities
	 */
	static async readUserEntityTypesAndEntitiesCached(filter, orgCode, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode || !defaults.tenantCode) {
				throw new Error('DEFAULT_ORG_CODE_OR_TENANT_CODE_NOT_SET')
			}

			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:entity_types:user_types`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const tenantCodes = { [Op.in]: [defaults.tenantCode, tenantCode] }
			const entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities(filter, tenantCodes)

			try {
				await cacheHelper.set(cacheKey, entityTypes, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache user entity types and entities:', cacheErr.message)
			}

			return entityTypes
		} catch (error) {
			console.warn('Error in readUserEntityTypesAndEntitiesCached, falling back to database:', error.message)
			const defaults = await getDefaults()
			const tenantCodes = { [Op.in]: [defaults.tenantCode, tenantCode] }
			return await entityTypeQueries.findUserEntityTypesAndEntities(filter, tenantCodes)
		}
	}

	/**
	 * Read all entity types and entities with caching.
	 * @param {Object} filter - Filter criteria
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Array>} - Cached entity types with entities
	 */
	static async readAllEntityTypesAndEntitiesCached(filter, orgCode, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode || !defaults.tenantCode) {
				throw new Error('DEFAULT_ORG_CODE_OR_TENANT_CODE_NOT_SET')
			}

			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:entity_types:all_with_entities`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const tenantCodes = { [Op.in]: [defaults.tenantCode, tenantCode] }
			const entityTypes = await entityTypeQueries.findAllEntityTypesAndEntities(filter, tenantCodes)

			try {
				await cacheHelper.set(cacheKey, entityTypes, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache all entity types and entities:', cacheErr.message)
			}

			return entityTypes
		} catch (error) {
			console.warn('Error in readAllEntityTypesAndEntitiesCached, falling back to database:', error.message)
			const defaults = await getDefaults()
			const tenantCodes = { [Op.in]: [defaults.tenantCode, tenantCode] }
			return await entityTypeQueries.findAllEntityTypesAndEntities(filter, tenantCodes)
		}
	}

	/**
	 * List role permission mappings with caching.
	 * @param {String} roleTitle - Role title
	 * @returns {Promise<Array>} - Cached role permission mappings
	 */
	static async listRolePermissionMappingsCached(roleTitle) {
		try {
			const cacheKey = `role_permissions:${roleTitle}`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const mappings = await rolePermissionMappingQueries.list(roleTitle)

			try {
				await cacheHelper.set(cacheKey, mappings, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache role permission mappings:', cacheErr.message)
			}

			return mappings
		} catch (error) {
			console.warn('Error in listRolePermissionMappingsCached, falling back to database:', error.message)
			return await rolePermissionMappingQueries.list(roleTitle)
		}
	}

	/**
	 * Find all role permission mappings with caching.
	 * @param {Object} filter - Filter criteria
	 * @param {Array} attributes - Attributes to select
	 * @returns {Promise<Array>} - Cached role permission mappings
	 */
	static async findAllRolePermissionMappingsCached(filter, attributes) {
		try {
			const cacheKey = `role_permissions:all:mappings`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const mappings = await rolePermissionMappingQueries.findAll(filter, attributes)

			try {
				await cacheHelper.set(cacheKey, mappings, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache all role permission mappings:', cacheErr.message)
			}

			return mappings
		} catch (error) {
			console.warn('Error in findAllRolePermissionMappingsCached, falling back to database:', error.message)
			return await rolePermissionMappingQueries.findAll(filter, attributes)
		}
	}

	/**
	 * Find all permissions with caching.
	 * @param {Object} filter - Filter criteria
	 * @param {Array} attributes - Attributes to select
	 * @param {Object} options - Query options
	 * @returns {Promise<Array>} - Cached permissions
	 */
	static async findAllPermissionsCached(filter, attributes, options = {}) {
		try {
			const cacheKey = `permissions:all`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const permissions = await permissionQueries.findAll(filter, attributes, options)

			try {
				await cacheHelper.set(cacheKey, permissions, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache permissions:', cacheErr.message)
			}

			return permissions
		} catch (error) {
			console.warn('Error in findAllPermissionsCached, falling back to database:', error.message)
			return await permissionQueries.findAll(filter, attributes, options)
		}
	}

	/**
	 * Find permissions with caching.
	 * @param {Object} filter - Filter criteria
	 * @param {Array} attributes - Attributes to select
	 * @returns {Promise<Array>} - Cached permissions
	 */
	static async findPermissionsCached(filter, attributes) {
		try {
			const cacheKey = `permissions:filtered`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const permissions = await permissionQueries.find(filter, attributes)

			try {
				await cacheHelper.set(cacheKey, permissions, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache filtered permissions:', cacheErr.message)
			}

			return permissions
		} catch (error) {
			console.warn('Error in findPermissionsCached, falling back to database:', error.message)
			return await permissionQueries.find(filter, attributes)
		}
	}

	/**
	 * Find one notification template with caching.
	 * @param {Object} filter - Filter criteria
	 * @param {String} tenantCode - Tenant code
	 * @param {Object} options - Query options
	 * @returns {Promise<Object>} - Cached notification template
	 */
	static async findOneNotificationTemplateCached(filter, tenantCode, options = {}) {
		try {
			const templateCode = filter.code || 'unknown'
			const cacheKey = `tenant:${tenantCode}:notification_template:${templateCode}`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const template = await notificationQueries.findOne(filter, tenantCode, options)

			if (template) {
				try {
					await cacheHelper.set(cacheKey, template, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache notification template:', cacheErr.message)
				}
			}

			return template
		} catch (error) {
			console.warn('Error in findOneNotificationTemplateCached, falling back to database:', error.message)
			return await notificationQueries.findOne(filter, tenantCode, options)
		}
	}

	/**
	 * Find templates by filter with caching.
	 * @param {Object} filter - Filter criteria
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Array>} - Cached templates
	 */
	static async findTemplatesByFilterCached(filter, orgCode, tenantCode) {
		try {
			const cacheKey = `tenant:${tenantCode}:org:${orgCode}:templates:filtered`
			const ttl = 300 // 5 minutes TTL

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const templates = await notificationQueries.findAll(filter, tenantCode)

			try {
				await cacheHelper.set(cacheKey, templates, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache filtered templates:', cacheErr.message)
			}

			return templates
		} catch (error) {
			console.warn('Error in findTemplatesByFilterCached, falling back to database:', error.message)
			return await notificationQueries.findAll(filter, tenantCode)
		}
	}

	/**
	 * Find form with caching using getOrSet pattern.
	 * @param {Object} filter - Filter criteria
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Object>} - Cached form data
	 */
	static async findFormCached(filter, orgCode, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode || !defaults.tenantCode) {
				throw new Error('DEFAULT_ORG_CODE_OR_TENANT_CODE_NOT_SET')
			}

			const cacheId = filter.type ? `${filter.type}:${filter.sub_type || 'default'}` : 'unknown'

			const form = await cacheHelper.getOrSet({
				tenantCode,
				orgCode: orgCode,
				ns: common.CACHE_CONFIG.namespaces.forms.name,
				id: cacheId,
				fetchFn: async () => {
					const formFilter = {
						...filter,
						status: 'ACTIVE',
						tenant_code: { [Op.in]: [tenantCode, defaults.tenantCode] },
					}

					if (!filter.organization_code) {
						formFilter.organization_code = { [Op.in]: [orgCode, defaults.orgCode] }
					}

					return await formQueries.findOne(formFilter, tenantCode)
				},
			})

			return form
		} catch (cacheError) {
			console.warn('Cache system failed for form details, falling back to database:', cacheError.message)

			// Fallback to direct database query
			const defaults = await getDefaults()
			const formFilter = {
				...filter,
				status: 'ACTIVE',
				tenant_code: { [Op.in]: [tenantCode, defaults.tenantCode] },
			}

			if (!filter.organization_code) {
				formFilter.organization_code = { [Op.in]: [orgCode, defaults.orgCode] }
			}

			return await formQueries.findOne(formFilter, tenantCode)
		}
	}

	/**
	 * Get users upcoming sessions with caching.
	 * @param {String} userId - User ID
	 * @param {Array} sessionIds - Array of session IDs
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Array>} - Cached users upcoming sessions
	 */
	static async usersUpcomingSessionsCached(userId, sessionIds, tenantCode) {
		try {
			const cacheKey = `tenant:${tenantCode}:users_upcoming_sessions:${userId}:${sessionIds
				.slice(0, 5)
				.join(',')}`
			const ttl = 60 // 1 minute TTL for session data

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const sessions = await sessionAttendeesQueries.usersUpcomingSessions(userId, sessionIds, tenantCode)

			if (sessions) {
				try {
					await cacheHelper.set(cacheKey, sessions, ttl)
				} catch (cacheErr) {
					console.warn('Failed to cache users upcoming sessions:', cacheErr.message)
				}
			}

			return sessions
		} catch (error) {
			console.warn('Error in usersUpcomingSessionsCached, falling back to database:', error.message)
			return await sessionAttendeesQueries.usersUpcomingSessions(userId, sessionIds, tenantCode)
		}
	}

	// ==================== ENTITY CACHED METHODS ====================

	/**
	 * Find all entities with caching.
	 * @param {Object} filter - Filter criteria
	 * @param {String} tenantCode - Tenant code
	 * @param {Object} options - Query options
	 * @returns {Promise<Array>} - Cached entities
	 */
	static async findAllEntitiesCached(filter, tenantCode, options = {}) {
		try {
			const cacheKey = `tenant:${tenantCode}:${common.CACHE_CONFIG.namespaces.entities.name}:all:${JSON.stringify(
				filter
			)}`
			const ttl = common.CACHE_CONFIG.namespaces.entities.defaultTtl || 1800 // 30 minutes

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const entities = await entityQueries.findAllEntities(filter, tenantCode, options)

			try {
				await cacheHelper.set(cacheKey, entities, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache entities:', cacheErr.message)
			}

			return entities
		} catch (error) {
			console.warn('Error in findAllEntitiesCached, falling back to database:', error.message)
			return await entityQueries.findAllEntities(filter, tenantCode, options)
		}
	}

	/**
	 * Get all entities with entity type details with caching.
	 * @param {Object} filters - Filter criteria
	 * @param {String} tenantCode - Tenant code
	 * @param {Number} page - Page number
	 * @param {Number} limit - Page size
	 * @param {String} search - Search term
	 * @returns {Promise<Array>} - Cached entities with entity type details
	 */
	static async getAllEntitiesWithEntityTypeDetailsCached(filters, tenantCode, page, limit, search) {
		try {
			const cacheKey = `tenant:${tenantCode}:${
				common.CACHE_CONFIG.namespaces.entities.name
			}:with_types:${page}:${limit}:${search || 'all'}:${JSON.stringify(filters)}`
			const ttl = common.CACHE_CONFIG.namespaces.entities.defaultTtl || 1800 // 30 minutes

			const cached = await cacheHelper.get(cacheKey)
			if (cached) {
				return cached
			}

			const entities = await entityQueries.getAllEntitiesWithEntityTypeDetails(
				filters,
				tenantCode,
				page,
				limit,
				search
			)

			try {
				await cacheHelper.set(cacheKey, entities, ttl)
			} catch (cacheErr) {
				console.warn('Failed to cache entities with entity type details:', cacheErr.message)
			}

			return entities
		} catch (error) {
			console.warn('Error in getAllEntitiesWithEntityTypeDetailsCached, falling back to database:', error.message)
			return await entityQueries.getAllEntitiesWithEntityTypeDetails(filters, tenantCode, page, limit, search)
		}
	}

	// ==================== ALIAS METHODS FOR BACKWARD COMPATIBILITY ====================

	/**
	 * Alias for getOrganizationByIdCached to match organization service naming.
	 */
	static async getByIdCached(orgCode, tenantCode) {
		return await this.getOrganizationByIdCached(orgCode, tenantCode)
	}

	/**
	 * Alias for listRolePermissionMappingsCached to match role-permission-mapping service naming.
	 */
	static async listCached(roleTitle) {
		return await this.listRolePermissionMappingsCached(roleTitle)
	}

	// ==================== CACHE INVALIDATION METHODS ====================

	/**
	 * Invalidate user-related cache entries.
	 * @param {String} userId - User ID to invalidate
	 * @param {String} tenantCode - Tenant code
	 * @param {String} orgCode - Organization code
	 */
	static async invalidateUserCache(userId, tenantCode, orgCode) {
		try {
			const menteeKey = `tenant:${tenantCode}:org:${orgCode}:mentee:${userId}`
			const mentorKey = `tenant:${tenantCode}:org:${orgCode}:mentor:${userId}`

			await Promise.all([cacheHelper.del(menteeKey), cacheHelper.del(mentorKey)])
		} catch (error) {
			console.warn('Failed to invalidate user cache:', error.message)
		}
	}

	/**
	 * Invalidate organization-related cache entries.
	 * @param {Array} orgIds - Organization IDs to invalidate
	 * @param {String} tenantCode - Tenant code
	 */
	static async invalidateOrgCache(orgIds, tenantCode) {
		try {
			const orgKey = `tenant:${tenantCode}:org:all:users-by-org:${orgIds.sort().join(',')}`
			await cacheHelper.del(orgKey)
		} catch (error) {
			console.warn('Failed to invalidate organization cache:', error.message)
		}
	}

	/**
	 * Invalidate user-related caches after user deletion operations.
	 * This should be called after user deletion to ensure cache consistency.
	 * @param {String} userId - User ID that was deleted
	 * @param {String} tenantCode - Tenant code
	 * @param {String} orgCode - Organization code
	 * @param {Boolean} isMentor - Whether the deleted user was a mentor
	 */
	static async invalidateUserDeletionCaches(userId, tenantCode, orgCode, isMentor = false) {
		try {
			console.log(`Starting cache invalidation for deleted user ${userId}`)

			// 1. Invalidate user-specific caches
			await this._invalidateUserSpecificCaches(userId, tenantCode, orgCode, isMentor)

			// 2. Invalidate session-related caches
			await this._invalidateSessionCaches(tenantCode)

			// 3. Invalidate organization-wide user lists
			await this._invalidateOrganizationCaches(tenantCode, orgCode)

			console.log(`Completed cache invalidation for deleted user ${userId}`)
		} catch (error) {
			console.error('Error during user deletion cache invalidation:', error.message)
			// Don't throw - cache failures should not block user deletion
		}
	}

	/**
	 * Invalidate user-specific cached data.
	 * @private
	 */
	static async _invalidateUserSpecificCaches(userId, tenantCode, orgCode, isMentor) {
		try {
			// Invalidate mentee profile cache
			await cacheHelper.evictByPattern(
				`tenant:${tenantCode}:org:*:${common.CACHE_CONFIG.namespaces.mentee_profile.name}:${userId}`
			)

			// Invalidate mentor profile cache if applicable
			if (isMentor) {
				await cacheHelper.evictByPattern(
					`tenant:${tenantCode}:org:*:${common.CACHE_CONFIG.namespaces.mentor_profile.name}:${userId}`
				)
			}

			// Invalidate user extension cache
			await cacheHelper.evictByPattern(
				`tenant:${tenantCode}:org:*:${common.CACHE_CONFIG.namespaces.user_extension.name}:*${userId}*`
			)

			// Invalidate bulk user caches containing this user
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:*users_by_ids:*`)
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:*mentors_by_ids:*`)
		} catch (error) {
			console.warn('Failed to invalidate user-specific caches:', error.message)
		}
	}

	/**
	 * Invalidate session-related caches after user deletion.
	 * @private
	 */
	static async _invalidateSessionCaches(tenantCode) {
		try {
			// Invalidate all upcoming sessions caches
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:upcoming_sessions_*`)
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:all_upcoming_sessions:*`)

			// Invalidate session namespace
			await cacheHelper.evictNamespace({
				tenantCode,
				orgCode: '*', // All orgs
				ns: common.CACHE_CONFIG.namespaces.sessions.name,
			})

			// Invalidate upcoming public sessions
			await cacheHelper.evictNamespace({
				tenantCode,
				orgCode: '*', // All orgs
				ns: common.CACHE_CONFIG.namespaces['upcoming-public-sessions'].name,
			})
		} catch (error) {
			console.warn('Failed to invalidate session caches:', error.message)
		}
	}

	/**
	 * Invalidate organization-wide caches after user deletion.
	 * @private
	 */
	static async _invalidateOrganizationCaches(tenantCode, orgCode) {
		try {
			// Invalidate organization user lists
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:org_users:${orgCode}*`)
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:*users_by_org:*`)
		} catch (error) {
			console.warn('Failed to invalidate organization caches:', error.message)
		}
	}

	/**
	 * Invalidate caches after user update operations.
	 * This should be called after user profile updates to ensure cache consistency.
	 * @param {String} userId - User ID that was updated
	 * @param {String} tenantCode - Tenant code
	 * @param {String} orgCode - Organization code
	 * @param {Boolean} isMentor - Whether the user is a mentor
	 */
	static async invalidateUserUpdateCaches(userId, tenantCode, orgCode, isMentor = false) {
		try {
			console.log(`Starting cache invalidation for updated user ${userId}`)

			// Invalidate user-specific caches (same as deletion but without bulk invalidation)
			await cacheHelper.evictByPattern(
				`tenant:${tenantCode}:org:*:${common.CACHE_CONFIG.namespaces.mentee_profile.name}:${userId}`
			)

			if (isMentor) {
				await cacheHelper.evictByPattern(
					`tenant:${tenantCode}:org:*:${common.CACHE_CONFIG.namespaces.mentor_profile.name}:${userId}`
				)
			}

			await cacheHelper.evictByPattern(
				`tenant:${tenantCode}:org:*:${common.CACHE_CONFIG.namespaces.user_extension.name}:*${userId}*`
			)

			// Invalidate bulk user caches that might contain this user
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:*users_by_ids:*`)
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:*mentors_by_ids:*`)

			console.log(`Completed cache invalidation for updated user ${userId}`)
		} catch (error) {
			console.error('Error during user update cache invalidation:', error.message)
			// Don't throw - cache failures should not block user updates
		}
	}

	/**
	 * Invalidate caches after user creation operations.
	 * This should be called after user creation to ensure cache consistency.
	 * @param {String} tenantCode - Tenant code
	 * @param {String} orgCode - Organization code
	 */
	static async invalidateUserCreationCaches(tenantCode, orgCode) {
		try {
			console.log(`Starting cache invalidation for user creation in org ${orgCode}`)

			// Invalidate organization user lists to include new user
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:org_users:${orgCode}*`)
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:*users_by_org:*`)

			// Invalidate bulk user caches
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:*users_by_ids:*`)
			await cacheHelper.evictByPattern(`tenant:${tenantCode}:*mentors_by_ids:*`)

			console.log(`Completed cache invalidation for user creation in org ${orgCode}`)
		} catch (error) {
			console.error('Error during user creation cache invalidation:', error.message)
			// Don't throw - cache failures should not block user creation
		}
	}

	/**
	 * Invalidate form-related caches after CUD operations.
	 * @param {String} tenantCode - Tenant code
	 * @param {String} orgCode - Organization code
	 */
	static async invalidateFormCaches(tenantCode, orgCode) {
		try {
			// Invalidate forms namespace
			await cacheHelper.evictNamespace({
				tenantCode,
				orgCode: orgCode,
				ns: common.CACHE_CONFIG.namespaces.forms.name,
			})

			// Special handling for default org - invalidate all orgs
			const defaults = await getDefaults()
			if (defaults.orgCode === orgCode) {
				await cacheHelper.evictTenantByPattern(tenantCode, {
					patternSuffix: `org:*:${common.CACHE_CONFIG.namespaces.forms.name}:*`,
				})
			}
		} catch (err) {
			console.error('Form cache invalidation failed', err)
			// Don't throw - cache failures should not block main operations
		}
	}

	/**
	 * Find one organization extension with caching (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @param {Object} filter - Filter criteria
	 * @param {String} tenantCode - Tenant code
	 * @param {Object} options - Query options
	 * @returns {Promise<Object>} - Cached organization extension data
	 */
	static async findOneOrganizationCached(filter, tenantCode, options = {}) {
		try {
			// Create cache ID based on all parameters to ensure cache uniqueness
			const cacheId = `org_ext_one:${JSON.stringify({ filter, options })}`

			let orgExtension
			try {
				orgExtension = await cacheHelper.getOrSet({
					tenantCode,
					orgCode: filter.organization_code || 'default',
					ns: common.CACHE_CONFIG.namespaces.organizations.name,
					id: cacheId,
					fetchFn: async () => {
						return await organizationExtensionQueries.findOne(filter, tenantCode, options)
					},
				})
			} catch (cacheError) {
				console.warn(
					'Cache system failed for organization extension findOne, falling back to database:',
					cacheError.message
				)
				orgExtension = await organizationExtensionQueries.findOne(filter, tenantCode, options)
			}

			return orgExtension
		} catch (error) {
			console.warn('Error in findOneOrganizationCached, falling back to database:', error.message)
			return await organizationExtensionQueries.findOne(filter, tenantCode, options)
		}
	}

	/**
	 * Find all organization extensions with caching (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @param {Object} filter - Filter criteria
	 * @param {String} tenantCode - Tenant code
	 * @param {Object} options - Query options
	 * @returns {Promise<Array>} - Cached organization extensions data
	 */
	static async findAllOrganizationsCached(filter, tenantCode, options = {}) {
		try {
			// Create cache ID based on all parameters to ensure cache uniqueness
			const cacheId = `org_ext_all:${JSON.stringify({ filter, options })}`

			let orgExtensions
			try {
				orgExtensions = await cacheHelper.getOrSet({
					tenantCode: tenantCode,
					orgCode: filter.organization_code || 'default',
					ns: common.CACHE_CONFIG.namespaces.organizations.name,
					id: cacheId,
					fetchFn: async () => {
						return await organizationExtensionQueries.findAll(filter, options)
					},
				})
			} catch (cacheError) {
				console.warn(
					'Cache system failed for organization extensions findAll, falling back to database:',
					cacheError.message
				)
				orgExtensions = await organizationExtensionQueries.findAll(filter, options)
			}

			return orgExtensions
		} catch (error) {
			console.warn('Error in findAllOrganizationsCached, falling back to database:', error.message)
			return await organizationExtensionQueries.findAll(filter, options)
		}
	}

	/**
	 * Process entity types to add value and labels with caching
	 * @param {Array} responseData - Data to modify
	 * @param {Array} orgCodes - Organization codes
	 * @param {String} modelName - Model name for entity search
	 * @param {String} orgCodeKey - Key representing org id in responseData
	 * @param {Array} entityType - Array of entity types value
	 * @param {Array} tenantCodes - Array of tenant codes
	 * @returns {Promise<Array>} - Modified response data with value labels
	 */
	static async processEntityTypesToAddValueLabelsCached(
		responseData,
		orgCodes,
		modelName,
		orgCodeKey,
		entityType,
		tenantCodes = []
	) {
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

			if (!orgCodes.includes(defaults.orgCode)) {
				orgCodes.push(defaults.orgCode)
			}

			if (!tenantCodes.includes(defaults.tenantCode)) {
				tenantCodes.push(defaults.tenantCode)
			}

			const filter = {
				status: 'ACTIVE',
				has_entities: true,
				organization_code: { [Op.in]: orgCodes },
				tenant_code: { [Op.in]: tenantCodes },
				model_names: { [Op.contains]: [modelName] },
			}

			if (entityType && entityType.length > 0) {
				filter.value = { [Op.in]: entityType }
			}

			// Use cached entity types method
			const entityTypesAndEntities = await this.readUserEntityTypesAndEntitiesCached(
				filter,
				orgCodes[0],
				tenantCodes[0]
			)

			if (!entityTypesAndEntities || entityTypesAndEntities.length === 0) {
				return responseData
			}

			// Group entity data by entity type value for efficient lookup
			const entityTypeMap = {}
			entityTypesAndEntities.forEach((entityType) => {
				entityTypeMap[entityType.value] = entityType.entities || []
			})

			// Process response data to add value labels
			const processedData = responseData.map((item) => {
				const processedItem = { ...item }

				Object.keys(entityTypeMap).forEach((entityTypeValue) => {
					const entityTypeData = entityTypeMap[entityTypeValue]
					const itemValue = processedItem[entityTypeValue]

					if (itemValue && Array.isArray(itemValue)) {
						processedItem[entityTypeValue] = itemValue.map((value) => {
							const entity = entityTypeData.find((e) => e.value === value)
							return entity ? { value: entity.value, label: entity.label } : value
						})
					}
				})

				return processedItem
			})

			return processedData
		} catch (error) {
			console.warn(
				'Error in processEntityTypesToAddValueLabelsCached, falling back to original data:',
				error.message
			)
			return responseData
		}
	}
}
