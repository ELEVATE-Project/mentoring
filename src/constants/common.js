/**
 * name : constants/common.js
 * author : Aman Kumar Gupta
 * Date : 04-Nov-2021
 * Description : All commonly used constants through out the service
 */

function getPaginationOffset(page, limit) {
	return (page - 1) * limit
}
const ENTITY_TYPE_DATA_TYPES = {
	ARRAY_TYPES: ['ARRAY[STRING]', 'ARRAY[INTEGER]', 'ARRAY[TEXT]'],
	STRING_TYPES: ['STRING', 'TEXT'],
	NUMERIC_TYPES: ['INTEGER', 'BIGINT'],
	BOOLEAN: ['BOOLEAN'],
	JSON: ['JSON', 'JSONB'],
}
const defaultOrgPolicies = () => {
	return {
		session_visibility_policy: process.env.DEFAULT_SESSION_VISIBILITY_POLICY,
		mentor_visibility_policy: process.env.DEFAULT_MENTOR_VISIBILITY_POLICY,
		mentee_visibility_policy: process.env.DEFAULT_MENTEE_VISIBILITY_POLICY,
		external_session_visibility_policy: process.env.DEFAULT_EXTERNAL_SESSION_VISIBILITY_POLICY,
		external_mentor_visibility_policy: process.env.DEFAULT_EXTERNAL_MENTOR_VISIBILITY_POLICY,
		external_mentee_visibility_policy: process.env.DEFAULT_EXTERNAL_MENTEE_VISIBILITY_POLICY,
		allow_mentor_override: false,
		approval_required_for: [],
	}
}

module.exports = {
	pagination: {
		DEFAULT_PAGE_NO: 1,
		DEFAULT_PAGE_SIZE: 100,
		DEFAULT_LIMIT: 5,
	},
	getPaginationOffset,
	DELETE_METHOD: 'DELETE',
	dateFormat: 'dddd, Do MMMM YYYY',
	timeFormat: 'hh:mm A',
	MENTEE_SESSION_REMAINDER_EMAIL_CODE: 'mentee_session_reminder',
	MENTOR_SESSION_REMAINDER_EMAIL_CODE: 'mentor_session_reminder',
	MENTOR_SESSION_ONE_HOUR_REMAINDER_EMAIL_CODE: 'mentor_one_hour_before_session_reminder',
	UTC_DATE_TIME_FORMAT: 'YYYY-MM-DDTHH:mm:ss',
	internalAccessUrls: [
		'/notifications/emailCronJob',
		'/org-admin/roleChange',
		'/org-admin/updateOrganization',
		'/org-admin/deactivateUpcomingSession',
		'/admin/triggerPeriodicViewRefreshInternal',
		'/admin/triggerViewRebuildInternal',
		'/org-admin/updateRelatedOrgs',
		'/sessions/bulkUpdateMentorNames',
		'/organization/eventListener',
		'/users/update',
		'/sessions/removeAllSessions',
		'/mentoring/v1/users/add',
		'/mentoring/v1/users/delete',
		'/requestSessions/expire',
	],
	COMPLETED_STATUS: 'COMPLETED',
	UNFULFILLED_STATUS: 'UNFULFILLED',
	PUBLISHED_STATUS: 'PUBLISHED',
	LIVE_STATUS: 'LIVE',
	MENTOR_EVALUATING: 'mentor',
	internalCacheExpirationTime: process.env.INTERNAL_CACHE_EXP_TIME, // In Seconds
	RedisCacheExpiryTime: process.env.REDIS_CACHE_EXP_TIME,
	BBB_VALUE: 'BBB', // BigBlueButton code
	BBB_PLATFORM: 'BigBlueButton (Default)',
	REPORT_EMAIL_SUBJECT: 'Having issue in logging in/signing up',
	ADMIN_ROLE: 'admin',
	roleValidationPaths: [
		'/sessions/enroll/',
		'/sessions/unEnroll/',
		'/sessions/update',
		'/feedback/submit/',
		'/sessions/start/',
		'/mentors/share/',
		'/mentees/joinSession/',
		'/mentors/upcomingSessions/',
		'/issues/create',
	],
	MENTOR_ROLE: 'mentor',
	MENTEE_ROLE: 'mentee',
	USER_ROLE: 'user',
	PUBLIC_ROLE: 'public',
	MENTORING_SERVICE: 'mentoring',
	SESSION_MANAGER_ROLE: 'session_manager',
	MANAGE_SESSION_CODE: 'manage_session',
	MEDIUM: 'medium',
	RECOMMENDED_FOR: 'recommended_for',
	CATEGORIES: 'categories',
	BAR_CHART: 'bar_chart',
	jobsToCreate: [
		{
			jobId: 'mentoring_session_one_hour_',
			jobName: 'notificationBeforeAnHour',
			emailTemplate: 'mentor_one_hour_before_session_reminder',
		},
		{
			jobId: 'mentoring_session_one_day_',
			jobName: 'notificationBeforeOneDay',
			emailTemplate: 'mentor_session_reminder',
		},
		{
			jobId: 'mentoring_session_fifteen_min_',
			jobName: 'notificationBeforeFifteenMin',
			emailTemplate: 'mentee_session_reminder',
		},
		{
			jobId: 'job_to_mark_session_as_completed_',
			jobName: 'job_to_mark_session_as_completed_',
		},
	],
	notificationJobIdPrefixes: [
		'mentoring_session_one_hour_',
		'mentoring_session_one_day_',
		'mentoring_session_fifteen_min_',
	],
	jobPrefixToMarkSessionAsCompleted: 'job_to_mark_session_as_completed_',
	ORG_ADMIN_ROLE: 'org_admin',
	expireSessionRequest: 'job_to_mark_session_as_expired',
	// Default organization policies
	getDefaultOrgPolicies: defaultOrgPolicies,
	REPORT_TABLE: 'table',
	CURRENT: 'CURRENT',
	ALL: 'ALL',
	All: 'All',
	SYSTEM: 'SYSTEM',
	ASSOCIATED: 'ASSOCIATED',
	PATCH_METHOD: 'PATCH',
	GET_METHOD: 'GET',
	POST_METHOD: 'POST',
	excludedQueryParams: ['enrolled'],
	materializedViewsPrefix: 'm_',
	mentorExtensionModelName: 'MentorExtension',
	sessionModelName: 'Session',
	notificationEndPoint: '/mentoring/v1/notifications/emailCronJob',
	sessionCompleteEndpoint: '/mentoring/v1/sessions/completed/',
	expireSessionRequestEndpoint: '/mentoring/v1/requestSessions/expire',
	INACTIVE_STATUS: 'INACTIVE',
	ACTIVE_STATUS: 'ACTIVE',
	SEARCH: '',
	INVITED: 'INVITED',
	ENROLLED: 'ENROLLED',
	UNIT_OF_TIME: 'minutes',
	FILE_TYPE_CSV: 'text/csv',
	NO_OF_ATTEMPTS: 3,
	BACK_OFF_RETRY_QUEUE: 600000,
	tempFolderForBulkUpload: 'public/invites',
	sessionOutputFile: 'output-session-creation',
	reportOutputFile: 'output-report-data',
	csvExtension: '.csv',
	responseType: 'stream',
	azureBlobType: 'BlockBlob',
	STATUS: { FAILED: 'FAILED', PROCESSED: 'PROCESSED', UPLOADED: 'UPLOADED' },
	notificationEmailType: 'email',
	IST_TIMEZONE: 'Asia/Calcutta',
	UTC_TIMEZONE: '+00:00',
	TIMEZONE: 'IST',
	TIMEZONE_UTC: 'UTC',
	VALID_STATUS: 'Valid',
	MEETING_VALUES: {
		GOOGLE_LABEL: 'Google meet',
		ZOOM_LABEL: 'Zoom',
		BBB_LABEL: 'BigBlueButton (Default)',
		WHATSAPP_LABEL: 'WhatsApp',
		GOOGLE_VALUE: 'Gmeet',
		WHATSAPP_VALUE: 'whatsapp',
		ZOOM_VALUE: 'zoom',
		GOOGLE_PLATFORM: 'google',
		BBB_PLATFORM_VALUES: ['bigbluebutton', 'bbb'],
		GOOGLE_MEET_VALUES: ['googlemeet', 'gmeet'],
	},
	report_session_message: 'No sessions',
	SESSION: 'session',
	PLATFORMS_REGEX: /https:\/\/(?:meet|call|us\d{2}web)\.(\w+)\.com/,
	ZOOM_REGEX: /https:\/\/(?:meet|call|us\d{2}web|zoom)\.(\w+)\.us\/j\/(\d+)\?/,
	EMAIL_REGEX:
		/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
	STRING_NUMERIC_REGEX: /^[a-zA-Z0-9\-.,:\s]+$/,
	NUMERIC_REGEX: /^\d+$/,
	ACTIONS: { CREATE: 'create', EDIT: 'edit', DELETE: 'delete' },
	CSV_DATE_FORMAT: 'DD-MM-YYYY HH:mm',
	SESSION_TYPE: {
		PUBLIC: 'PUBLIC',
		PRIVATE: 'PRIVATE',
	},
	SESSION_OWNERSHIP_TYPE: {
		CREATOR: 'CREATOR',
		MENTOR: 'MENTOR',
	},
	PUSH: 'PUSH',
	POP: 'POP',
	AUTH_METHOD: {
		NATIVE: 'native',
		KEYCLOAK_PUBLIC_KEY: 'keycloak_public_key',
	},
	SESSION_VERIFICATION_METHOD: {
		USER_SERVICE: 'user_service_authenticated',
	},
	WRITE_ACCESS: 'w',
	READ_ACCESS: 'r',
	ENTITY_TYPE_DATA_TYPES,
	DEFAULT_RULES: {
		SESSION_TYPE: 'session',
		MENTOR_TYPE: 'mentor',
		ARRAY_TYPES: ENTITY_TYPE_DATA_TYPES.ARRAY_TYPES,
		VALID_ARRAY_OPERATORS: ['contains', 'containedBy', 'overlap'],
		STRING_TYPES: ENTITY_TYPE_DATA_TYPES.STRING_TYPES,
		VALID_STRING_OPERATORS: ['equals', 'notEquals'],
		NUMERIC_TYPES: ENTITY_TYPE_DATA_TYPES.NUMERIC_TYPES,
		VALID_NUMERIC_OPERATORS: [
			'equals',
			'notEquals',
			'greaterThan',
			'lessThanOrEqual',
			'lessThan',
			'greaterThanOrEqual',
		],
	},
	FALSE: 'false',
	CONNECTIONS_STATUS: {
		ACCEPTED: 'ACCEPTED',
		REJECTED: 'REJECTED',
		PENDING: 'PENDING',
		REQUESTED: 'REQUESTED',
		BLOCKED: 'BLOCKED',
		EXPIRED: 'EXPIRED',
	},
	CONNECTIONS_DEFAULT_MESSAGE: 'Hi, I would like to connect with you.',
	COMMUNICATION: {
		UNAUTHORIZED: 'Unauthorized',
	},
	SESSION_POST_RESOURCE_TYPE: 'post',
	SESSION_PRE_RESOURCE_TYPE: 'pre',
	USER_NOT_FOUND: 'USER NOT FOUND',
	UNDER_DELETION_STATUS: 'UNDER_DELETION',
	CACHE_CONFIG: {
		enableCache: true,
		shards: 32,
		common: {
			list: 'list',
		},
		namespaces: {
			forms: {
				name: 'forms',
				enabled: true,
				defaultTtl: 0, // No expiry
				useInternal: false,
			},
			entities: {
				name: 'entities',
				enabled: true,
				defaultTtl: 1800, // 30 mins
				useInternal: false,
			},
			entity_types: {
				name: 'entity_types',
				enabled: true,
				defaultTtl: 0, // No expiry
				useInternal: false,
			},
			organizations: {
				name: 'organizations',
				enabled: true,
				defaultTtl: 86400, // 24 hours
				useInternal: false,
			},
			roles_permissions: {
				name: 'roles_permissions',
				enabled: true,
				defaultTtl: 0, // No expiry
				useInternal: false,
			},
			permissions: {
				name: 'permissions',
				enabled: true,
				defaultTtl: 0, // No expiry
				useInternal: false,
			},
			notification_templates: {
				name: 'notification_templates',
				enabled: true,
				defaultTtl: 0, // No expiry
				useInternal: false,
			},
			mentor_profile: {
				name: 'mentor_profile',
				enabled: true,
				defaultTtl: 1800, // 30 mins
				useInternal: false,
			},
			mentee_profile: {
				name: 'mentee_profile',
				enabled: true,
				defaultTtl: 1800, // 30 mins
				useInternal: false,
			},
			sessions: {
				name: 'upcoming_sessions', // More specific: individual session details and user enrollments
				enabled: true,
				defaultTtl: 3600, // 1 hour
				useInternal: false,
				// add one variable to calculate size or data size -> need to discuss
			},
			'upcoming-public-sessions': {
				name: 'upcoming_public_sessions',
				enabled: true,
				defaultTtl: 600, // 10 minutes - shorter for dynamic data
				useInternal: false, // Redis only for large datasets
			},
			'sessions-metadata': {
				name: 'sessions-metadata',
				enabled: true,
				defaultTtl: 300, // 5 minutes - very dynamic metadata
				useInternal: true, // Small metadata can use memory
			},
			app_config: {
				name: 'app_config',
				enabled: true,
				defaultTtl: 0, // no expiry
				useInternal: true, // Enable memory cache for faster access
			},
		},
	},
}
