'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.bulkInsert('organization_extension', [
			{
				organization_id: process.env.DEFAULT_ORG_ID,
				organization_code: process.env.DEFAULT_ORGANIZATION_CODE,
				tenant_code: process.env.DEFAULT_TENANT_CODE,

				session_visibility_policy: 'CURRENT',
				mentor_visibility_policy: 'CURRENT',
				external_session_visibility_policy: 'CURRENT',
				external_mentor_visibility_policy: 'CURRENT',

				approval_required_for: Sequelize.literal(`ARRAY[]::text[]`), // corrected from CSV `{}` → `[]`
				allow_mentor_override: false,

				created_by: '1',
				updated_by: '1',

				mentee_feedback_question_set: 'MENTEE_QS1',
				mentor_feedback_question_set: 'MENTOR_QS2',

				uploads: null,
				mentee_visibility_policy: 'CURRENT',
				external_mentee_visibility_policy: 'CURRENT',
				name: null,
				theme: null,
				deleted_at: null,
				created_at: new Date('2025-12-08T15:34:21.220Z'),
				updated_at: new Date('2025-12-08T15:34:21.220Z'),
			},
		])
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.bulkDelete('organization_extension', {
			organization_id: '1',
			organization_code: 'default_code',
			tenant_code: 'default',
		})
	},
}
