const entity = {
	create: ['id', 'allow_filtering', 'created_at', 'updated_at', 'created_by', 'updated_by'],
	update: ['id', 'allow_filtering', 'created_at', 'updated_at', 'created_by', 'updated_by'],
}

const entityType = {
	create: ['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'organization_id'],
}

const feedback = {
	submit: ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
}

const form = {
	create: ['id', 'organization_id', 'version', 'created_at', 'updated_at', 'created_by', 'updated_by'],
}

const notification = {
	create: ['id', 'organization_id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
	update: ['id', 'organization_id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
}

const profile = {
	create: [
		'user_id',
		'rating',
		'mentor_visibility',
		'mentee_visibility',
		'visible_to_organizations',
		'external_session_visibility',
		'external_mentor_visibility',
		'external_mentee_visibility',
		'stats',
		'created_at',
		'updated_at',
		'created_by',
		'updated_by',
	],
	update: [
		'user_id',
		'rating',
		'mentor_visibility',
		'mentee_visibility',
		'visible_to_organizations',
		'external_session_visibility',
		'external_mentor_visibility',
		'external_mentee_visibility',
		'stats',
		'created_at',
		'updated_at',
		'created_by',
		'updated_by',
	],
}

const questionSet = {
	create: ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
	update: ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
}

const questions = {
	create: ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
	update: ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
}

const sessions = {
	update: [
		'id',
		'session_reschedule',
		'status',
		'mentee_password',
		'started_at',
		'mentor_password',
		'share_link',
		'completed_at',
		'seats_remaining',
		'seats_limit',
		'custom_entity_text',
		'mentor_name',
		'created_at',
		'updated_at',
		'created_by',
		'updated_by',
	],
}

const queryForbiddenPatterns = [
	// Injection/Bypass Tricks
	'--',
	';',
	'/*',
	'*/',
	'#',
	'\\',
	"'",
	'"',
	'char(',
	'chr(',
	'concat(',
	'||',

	// DML/DDL Commands
	'insert',
	'update',
	'delete',
	'drop',
	'truncate',
	'alter',
	'create',
	'replace',
	'rename',
	'merge',

	// Joins & Advanced Access Paths
	'cross join',
	'left join lateral',
	'right join lateral',
	'natural join',

	// Recursive & CTEs
	'with',
	'with recursive',

	// Union & Subquery Abuse
	'union',
	'intersect',
	'except',

	// System Info Access
	'information_schema',
	'pg_catalog',
	'pg_roles',
	'pg_user',
	'pg_shadow',
	'pg_authid',
	'pg_group',
	'pg_settings',
	'pg_stat',
	'pg_stat_activity',
	'pg_stat_user_tables',

	// Dangerous PostgreSQL Functions
	'pg_sleep',
	'pg_read_file',
	'pg_write_file',
	'pg_ls_dir',
	'pg_terminate_backend',
	'pg_cancel_backend',
	'pg_backend_pid',
	'pg_execute_server_program',
	'current_setting',
	'set_config',
	'dblink',
	'xml',
	'json_agg',
	'array_agg',
	'string_agg',

	// Privilege Escalation
	'set role',
	'set session authorization',
	'grant',
	'revoke',
	'owner to',

	// File/Blob Access
	'lo_import',
	'lo_export',
	'copy from',
	'copy to',

	// Unsafe Languages/Extensions
	'plperlu',
	'plpythonu',
	'pltclu',
	'untrusted',

	// Execution Abuse
	'execute',
	'do $$',
	'$$ language',
	'declare',
	'begin',
	'commit',
	'rollback',

	// Temp or Transactional Tables
	'temporary table',
	'temp table',
	'global temp',
	'unlogged',

	// Admin or App Tables (optional)
	'users',
	'admins',
	'passwords',
	'audit_logs',
]

module.exports = {
	entity,
	entityType,
	feedback,
	form,
	notification,
	profile,
	questionSet,
	questions,
	sessions,
	queryForbiddenPatterns,
}
