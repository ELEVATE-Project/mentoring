const getIndexQueries = (tenantCode) => [
	{
		modelName: 'Session',
		queries: [
			`CREATE INDEX IF NOT EXISTS ${tenantCode}_idx_filtered_sessions ON ${tenantCode}_m_sessions (mentor_organization_id, status, type, mentor_id);`,
			`CREATE INDEX IF NOT EXISTS ${tenantCode}_idx_sessions_mentor_status_date ON ${tenantCode}_m_sessions (mentor_id, status, start_date);`,
			`CREATE INDEX IF NOT EXISTS ${tenantCode}_idx_sessions_status_type_date ON ${tenantCode}_m_sessions (status, type, start_date);`,
		],
	},
	{
		modelName: 'UserExtension',
		queries: [
			`CREATE INDEX IF NOT EXISTS ${tenantCode}_idx_user_ext_org_name ON ${tenantCode}_m_user_extensions (organization_id, lower(name)) WHERE is_mentor = true;`,
			`CREATE INDEX IF NOT EXISTS ${tenantCode}_idx_user_ext_email ON ${tenantCode}_m_user_extensions (email);`,
			`CREATE INDEX IF NOT EXISTS ${tenantCode}_idx_user_ext_org_code ON ${tenantCode}_m_user_extensions (organization_code);`,
		],
	},
]

module.exports = getIndexQueries
