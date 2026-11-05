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
		'mentee_password',
		'started_at',
		'mentor_password',
		'share_link',
		'completed_at',
		'seats_remaining',
		'custom_entity_text',
		'mentor_name',
		'created_at',
		'updated_at',
		'created_by',
		'updated_by',
	],
}

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
}
