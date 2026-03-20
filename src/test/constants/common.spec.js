/**
 * name : common.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for common constants and utilities
 */

const common = require('@constants/common')

describe('Common Constants', () => {
	describe('getPaginationOffset', () => {
		test('should calculate correct offset for page 1', () => {
			const offset = common.getPaginationOffset(1, 10)
			expect(offset).toBe(0)
		})

		test('should calculate correct offset for page 2', () => {
			const offset = common.getPaginationOffset(2, 10)
			expect(offset).toBe(10)
		})

		test('should calculate correct offset for page 5 with limit 20', () => {
			const offset = common.getPaginationOffset(5, 20)
			expect(offset).toBe(80)
		})

		test('should handle edge case with page 0', () => {
			const offset = common.getPaginationOffset(0, 10)
			expect(offset).toBe(-10)
		})

		test('should handle large page numbers', () => {
			const offset = common.getPaginationOffset(1000, 50)
			expect(offset).toBe(49950)
		})

		test('should handle different limit values', () => {
			expect(common.getPaginationOffset(3, 5)).toBe(10)
			expect(common.getPaginationOffset(3, 100)).toBe(200)
		})
	})

	describe('getDefaultOrgPolicies', () => {
		let originalEnv

		beforeAll(() => {
			originalEnv = { ...process.env }
			process.env.DEFAULT_SESSION_VISIBILITY_POLICY = 'PUBLIC'
			process.env.DEFAULT_MENTOR_VISIBILITY_POLICY = 'PUBLIC'
			process.env.DEFAULT_MENTEE_VISIBILITY_POLICY = 'PUBLIC'
			process.env.DEFAULT_EXTERNAL_SESSION_VISIBILITY_POLICY = 'PRIVATE'
			process.env.DEFAULT_EXTERNAL_MENTOR_VISIBILITY_POLICY = 'PRIVATE'
			process.env.DEFAULT_EXTERNAL_MENTEE_VISIBILITY_POLICY = 'PRIVATE'
		})

		afterAll(() => {
			process.env = originalEnv
		})

		test('should return default organization policies', () => {
			const policies = common.getDefaultOrgPolicies()

			expect(policies).toHaveProperty('session_visibility_policy')
			expect(policies).toHaveProperty('mentor_visibility_policy')
			expect(policies).toHaveProperty('mentee_visibility_policy')
			expect(policies).toHaveProperty('external_session_visibility_policy')
			expect(policies).toHaveProperty('external_mentor_visibility_policy')
			expect(policies).toHaveProperty('external_mentee_visibility_policy')
			expect(policies).toHaveProperty('allow_mentor_override')
			expect(policies).toHaveProperty('approval_required_for')
		})

		test('should set allow_mentor_override to false by default', () => {
			const policies = common.getDefaultOrgPolicies()
			expect(policies.allow_mentor_override).toBe(false)
		})

		test('should set approval_required_for to empty array by default', () => {
			const policies = common.getDefaultOrgPolicies()
			expect(policies.approval_required_for).toEqual([])
			expect(Array.isArray(policies.approval_required_for)).toBe(true)
		})

		test('should read visibility policies from environment variables', () => {
			const policies = common.getDefaultOrgPolicies()
			expect(policies.session_visibility_policy).toBe('PUBLIC')
			expect(policies.mentor_visibility_policy).toBe('PUBLIC')
			expect(policies.external_session_visibility_policy).toBe('PRIVATE')
		})

		test('should return new object on each call', () => {
			const policies1 = common.getDefaultOrgPolicies()
			const policies2 = common.getDefaultOrgPolicies()

			expect(policies1).not.toBe(policies2)
			expect(policies1).toEqual(policies2)
		})
	})

	describe('ENTITY_TYPE_DATA_TYPES', () => {
		test('should contain ARRAY_TYPES', () => {
			expect(common.ENTITY_TYPE_DATA_TYPES.ARRAY_TYPES).toBeDefined()
			expect(Array.isArray(common.ENTITY_TYPE_DATA_TYPES.ARRAY_TYPES)).toBe(true)
			expect(common.ENTITY_TYPE_DATA_TYPES.ARRAY_TYPES).toContain('ARRAY[STRING]')
			expect(common.ENTITY_TYPE_DATA_TYPES.ARRAY_TYPES).toContain('ARRAY[INTEGER]')
			expect(common.ENTITY_TYPE_DATA_TYPES.ARRAY_TYPES).toContain('ARRAY[TEXT]')
		})

		test('should contain STRING_TYPES', () => {
			expect(common.ENTITY_TYPE_DATA_TYPES.STRING_TYPES).toBeDefined()
			expect(common.ENTITY_TYPE_DATA_TYPES.STRING_TYPES).toContain('STRING')
			expect(common.ENTITY_TYPE_DATA_TYPES.STRING_TYPES).toContain('TEXT')
		})

		test('should contain NUMERIC_TYPES', () => {
			expect(common.ENTITY_TYPE_DATA_TYPES.NUMERIC_TYPES).toBeDefined()
			expect(common.ENTITY_TYPE_DATA_TYPES.NUMERIC_TYPES).toContain('INTEGER')
			expect(common.ENTITY_TYPE_DATA_TYPES.NUMERIC_TYPES).toContain('BIGINT')
		})

		test('should contain BOOLEAN type', () => {
			expect(common.ENTITY_TYPE_DATA_TYPES.BOOLEAN).toBeDefined()
			expect(common.ENTITY_TYPE_DATA_TYPES.BOOLEAN).toContain('BOOLEAN')
		})

		test('should contain JSON types', () => {
			expect(common.ENTITY_TYPE_DATA_TYPES.JSON).toBeDefined()
			expect(common.ENTITY_TYPE_DATA_TYPES.JSON).toContain('JSON')
			expect(common.ENTITY_TYPE_DATA_TYPES.JSON).toContain('JSONB')
		})
	})

	describe('Pagination constants', () => {
		test('should have correct default pagination values', () => {
			expect(common.pagination.DEFAULT_PAGE_NO).toBe(1)
			expect(common.pagination.DEFAULT_PAGE_SIZE).toBe(100)
			expect(common.pagination.DEFAULT_LIMIT).toBe(5)
		})
	})

	describe('Role constants', () => {
		test('should define all required roles', () => {
			expect(common.ADMIN_ROLE).toBe('admin')
			expect(common.MENTOR_ROLE).toBe('mentor')
			expect(common.MENTEE_ROLE).toBe('mentee')
			expect(common.USER_ROLE).toBe('user')
			expect(common.PUBLIC_ROLE).toBe('public')
			expect(common.ORG_ADMIN_ROLE).toBe('org_admin')
			expect(common.SESSION_MANAGER_ROLE).toBe('session_manager')
		})
	})

	describe('Status constants', () => {
		test('should define all session statuses', () => {
			expect(common.COMPLETED_STATUS).toBe('COMPLETED')
			expect(common.UNFULFILLED_STATUS).toBe('UNFULFILLED')
			expect(common.PUBLISHED_STATUS).toBe('PUBLISHED')
			expect(common.LIVE_STATUS).toBe('LIVE')
			expect(common.INACTIVE_STATUS).toBe('INACTIVE')
			expect(common.ACTIVE_STATUS).toBe('ACTIVE')
			expect(common.UNDER_DELETION_STATUS).toBe('UNDER_DELETION')
		})
	})

	describe('Connection status constants', () => {
		test('should define all connection statuses', () => {
			expect(common.CONNECTIONS_STATUS.ACCEPTED).toBe('ACCEPTED')
			expect(common.CONNECTIONS_STATUS.REJECTED).toBe('REJECTED')
			expect(common.CONNECTIONS_STATUS.PENDING).toBe('PENDING')
			expect(common.CONNECTIONS_STATUS.REQUESTED).toBe('REQUESTED')
			expect(common.CONNECTIONS_STATUS.BLOCKED).toBe('BLOCKED')
			expect(common.CONNECTIONS_STATUS.EXPIRED).toBe('EXPIRED')
		})

		test('should have default connection message', () => {
			expect(common.CONNECTIONS_DEFAULT_MESSAGE).toBe('Hi, I would like to connect with you.')
		})
	})

	describe('Meeting platform constants', () => {
		test('should define BBB constants', () => {
			expect(common.BBB_VALUE).toBe('BBB')
			expect(common.BBB_PLATFORM).toBe('BigBlueButton (Default)')
		})

		test('should define meeting values', () => {
			expect(common.MEETING_VALUES.GOOGLE_LABEL).toBe('Google meet')
			expect(common.MEETING_VALUES.ZOOM_LABEL).toBe('Zoom')
			expect(common.MEETING_VALUES.BBB_LABEL).toBe('BigBlueButton (Default)')
			expect(common.MEETING_VALUES.WHATSAPP_LABEL).toBe('WhatsApp')
			expect(common.MEETING_VALUES.GOOGLE_VALUE).toBe('Gmeet')
			expect(common.MEETING_VALUES.WHATSAPP_VALUE).toBe('whatsapp')
			expect(common.MEETING_VALUES.ZOOM_VALUE).toBe('zoom')
			expect(common.MEETING_VALUES.GOOGLE_PLATFORM).toBe('google')
		})

		test('should define platform value arrays', () => {
			expect(common.MEETING_VALUES.BBB_PLATFORM_VALUES).toContain('bigbluebutton')
			expect(common.MEETING_VALUES.BBB_PLATFORM_VALUES).toContain('bbb')
			expect(common.MEETING_VALUES.GOOGLE_MEET_VALUES).toContain('googlemeet')
			expect(common.MEETING_VALUES.GOOGLE_MEET_VALUES).toContain('gmeet')
		})
	})

	describe('Regex patterns', () => {
		test('should have valid email regex', () => {
			const emailRegex = common.EMAIL_REGEX
			expect(emailRegex.test('test@example.com')).toBe(true)
			expect(emailRegex.test('user.name@domain.co.in')).toBe(true)
			expect(emailRegex.test('invalid-email')).toBe(false)
			expect(emailRegex.test('@example.com')).toBe(false)
		})

		test('should have valid numeric regex', () => {
			const numericRegex = common.NUMERIC_REGEX
			expect(numericRegex.test('123')).toBe(true)
			expect(numericRegex.test('0')).toBe(true)
			expect(numericRegex.test('abc')).toBe(false)
			expect(numericRegex.test('12.34')).toBe(false)
		})

		test('should have valid string-numeric regex', () => {
			const stringNumericRegex = common.STRING_NUMERIC_REGEX
			expect(stringNumericRegex.test('Hello World')).toBe(true)
			expect(stringNumericRegex.test('Test123')).toBe(true)
			expect(stringNumericRegex.test('Test-123.456')).toBe(true)
			expect(stringNumericRegex.test('Test@123')).toBe(false)
		})

		test('should have valid platform regex', () => {
			const platformRegex = common.PLATFORMS_REGEX
			expect(platformRegex.test('https://meet.google.com/abc-def-ghi')).toBe(true)
			expect(platformRegex.test('https://call.zoom.com/j/123456')).toBe(true)
			expect(platformRegex.test('invalid-url')).toBe(false)
		})

		test('should have valid zoom regex', () => {
			const zoomRegex = common.ZOOM_REGEX
			expect(zoomRegex.test('https://zoom.us/j/123456?pwd=test')).toBe(true)
			expect(zoomRegex.test('https://us02web.zoom.us/j/123456?pwd=test')).toBe(true)
		})
	})

	describe('Cache configuration', () => {
		test('should have cache config with namespaces', () => {
			expect(common.CACHE_CONFIG).toBeDefined()
			expect(common.CACHE_CONFIG.namespaces).toBeDefined()
		})

		test('should have sessions namespace config', () => {
			const sessionsConfig = common.CACHE_CONFIG.namespaces.sessions
			expect(sessionsConfig.name).toBe('sessions')
			expect(sessionsConfig.enabled).toBe(true)
			expect(sessionsConfig.defaultTtl).toBe(86400)
			expect(sessionsConfig.useInternal).toBe(false)
		})

		test('should have entityTypes namespace config', () => {
			const entityTypesConfig = common.CACHE_CONFIG.namespaces.entityTypes
			expect(entityTypesConfig.name).toBe('entityTypes')
			expect(entityTypesConfig.enabled).toBe(true)
		})

		test('should have forms namespace config', () => {
			const formsConfig = common.CACHE_CONFIG.namespaces.forms
			expect(formsConfig.name).toBe('forms')
			expect(formsConfig.enabled).toBe(true)
		})

		test('should have all required namespace configs', () => {
			const namespaces = common.CACHE_CONFIG.namespaces
			expect(namespaces.sessions).toBeDefined()
			expect(namespaces.entityTypes).toBeDefined()
			expect(namespaces.forms).toBeDefined()
			expect(namespaces.organizations).toBeDefined()
			expect(namespaces.mentor).toBeDefined()
			expect(namespaces.mentee).toBeDefined()
			expect(namespaces.platformConfig).toBeDefined()
			expect(namespaces.notificationTemplates).toBeDefined()
			expect(namespaces.displayProperties).toBeDefined()
			expect(namespaces.permissions).toBeDefined()
			expect(namespaces.apiPermissions).toBeDefined()
		})
	})

	describe('Job configuration', () => {
		test('should define jobs to create', () => {
			expect(Array.isArray(common.jobsToCreate)).toBe(true)
			expect(common.jobsToCreate.length).toBeGreaterThan(0)
		})

		test('should have correct job structure', () => {
			const job = common.jobsToCreate[0]
			expect(job).toHaveProperty('jobId')
			expect(job).toHaveProperty('jobName')
		})

		test('should define notification job prefixes', () => {
			expect(Array.isArray(common.notificationJobIdPrefixes)).toBe(true)
			expect(common.notificationJobIdPrefixes).toContain('mentoring_session_one_hour_')
			expect(common.notificationJobIdPrefixes).toContain('mentoring_session_one_day_')
			expect(common.notificationJobIdPrefixes).toContain('mentoring_session_fifteen_min_')
		})
	})

	describe('Session type constants', () => {
		test('should define session types', () => {
			expect(common.SESSION_TYPE.PUBLIC).toBe('PUBLIC')
			expect(common.SESSION_TYPE.PRIVATE).toBe('PRIVATE')
		})

		test('should define session ownership types', () => {
			expect(common.SESSION_OWNERSHIP_TYPE.CREATOR).toBe('CREATOR')
			expect(common.SESSION_OWNERSHIP_TYPE.MENTOR).toBe('MENTOR')
		})
	})

	describe('Authentication methods', () => {
		test('should define auth methods', () => {
			expect(common.AUTH_METHOD.NATIVE).toBe('native')
			expect(common.AUTH_METHOD.KEYCLOAK_PUBLIC_KEY).toBe('keycloak_public_key')
		})

		test('should define session verification method', () => {
			expect(common.SESSION_VERIFICATION_METHOD.USER_SERVICE).toBe('user_service_authenticated')
		})
	})

	describe('Default rules configuration', () => {
		test('should define default rules types', () => {
			expect(common.DEFAULT_RULES.SESSION_TYPE).toBe('session')
			expect(common.DEFAULT_RULES.MENTOR_TYPE).toBe('mentor')
		})

		test('should define valid array operators', () => {
			expect(common.DEFAULT_RULES.VALID_ARRAY_OPERATORS).toContain('contains')
			expect(common.DEFAULT_RULES.VALID_ARRAY_OPERATORS).toContain('containedBy')
			expect(common.DEFAULT_RULES.VALID_ARRAY_OPERATORS).toContain('overlap')
		})

		test('should define valid string operators', () => {
			expect(common.DEFAULT_RULES.VALID_STRING_OPERATORS).toContain('equals')
			expect(common.DEFAULT_RULES.VALID_STRING_OPERATORS).toContain('notEquals')
		})

		test('should define valid numeric operators', () => {
			expect(common.DEFAULT_RULES.VALID_NUMERIC_OPERATORS).toContain('equals')
			expect(common.DEFAULT_RULES.VALID_NUMERIC_OPERATORS).toContain('notEquals')
			expect(common.DEFAULT_RULES.VALID_NUMERIC_OPERATORS).toContain('greaterThan')
			expect(common.DEFAULT_RULES.VALID_NUMERIC_OPERATORS).toContain('lessThan')
			expect(common.DEFAULT_RULES.VALID_NUMERIC_OPERATORS).toContain('greaterThanOrEqual')
			expect(common.DEFAULT_RULES.VALID_NUMERIC_OPERATORS).toContain('lessThanOrEqual')
		})
	})

	describe('Actions constants', () => {
		test('should define CRUD actions', () => {
			expect(common.ACTIONS.CREATE).toBe('create')
			expect(common.ACTIONS.EDIT).toBe('edit')
			expect(common.ACTIONS.DELETE).toBe('delete')
		})
	})

	describe('Sort order constants', () => {
		test('should define sort orders', () => {
			expect(common.SORT_ORDER.ASCENDING).toBe('ASC')
			expect(common.SORT_ORDER.DESCENDING).toBe('DESC')
		})
	})

	describe('Internal access URLs', () => {
		test('should define internal access URLs array', () => {
			expect(Array.isArray(common.internalAccessUrls)).toBe(true)
			expect(common.internalAccessUrls.length).toBeGreaterThan(0)
		})

		test('should contain specific internal endpoints', () => {
			expect(common.internalAccessUrls).toContain('/notifications/emailCronJob')
			expect(common.internalAccessUrls).toContain('/org-admin/roleChange')
			expect(common.internalAccessUrls).toContain('/admin/triggerPeriodicViewRefreshInternal')
		})
	})

	describe('Edge case: getPaginationOffset with negative values', () => {
		test('should handle negative page numbers', () => {
			const offset = common.getPaginationOffset(-1, 10)
			expect(offset).toBe(-20)
		})

		test('should handle negative limit', () => {
			const offset = common.getPaginationOffset(2, -10)
			expect(offset).toBe(-10)
		})
	})

	describe('Additional validation tests', () => {
		test('should ensure model name constants are defined', () => {
			expect(common.mentorExtensionModelName).toBe('MentorExtension')
			expect(common.userExtensionModelName).toBe('UserExtension')
			expect(common.sessionModelName).toBe('Session')
		})

		test('should define entity type model names array', () => {
			expect(Array.isArray(common.entityTypeModelNames)).toBe(true)
			expect(common.entityTypeModelNames).toContain('Session')
			expect(common.entityTypeModelNames).toContain('MentorExtension')
			expect(common.entityTypeModelNames).toContain('UserExtension')
		})

		test('should define status object with upload states', () => {
			expect(common.STATUS.FAILED).toBe('FAILED')
			expect(common.STATUS.PROCESSED).toBe('PROCESSED')
			expect(common.STATUS.UPLOADED).toBe('UPLOADED')
		})
	})
})