/**
 * name : validators/v1/users.js
 * author : Rakesh Kumar
 * Date : 01-Dec-2021
 * Description : Validations of users controller for internal API calls
 */

module.exports = {
	pendingFeedbacks: (req) => {},

	list: (req) => {
		req.checkQuery('type').notEmpty().withMessage('type can not be null').isString()
	},
	/**
	 * Validates internal API call for adding a new user
	 * Called from user service to mentoring service
	 */
	add: (req) => {
		if (
			req.body &&
			!req.body.organization_code &&
			Array.isArray(req.body.organizations) &&
			req.body.organizations.length > 0
		) {
			req.body.organization_code = req.body.organizations[0].code || req.body.organizations[0].id
		}
		if (req.body && typeof req.body.id === 'number') {
			req.body.id = req.body.id.toString()
		}
		req.checkBody('tenant_code')
			.notEmpty()
			.withMessage('tenant_code is required for multi-tenant isolation')
			.isString()
			.withMessage('tenant_code must be a string')
		req.checkBody('organization_code')
			.notEmpty()
			.withMessage('organization_code is required')
			.isString()
			.withMessage('organization_code must be a string')
		req.checkBody('id').notEmpty().withMessage('id is required').isString().withMessage('id must be a string')
	},
	/**
	 * Validates internal API call for updating user details
	 * Called from user service to mentoring service
	 */
	update: (req) => {
		if (
			req.body &&
			!req.body.organization_code &&
			Array.isArray(req.body.organizations) &&
			req.body.organizations.length > 0
		) {
			req.body.organization_code = req.body.organizations[0].code || req.body.organizations[0].id
		}
		if (req.body && typeof req.body.id === 'number') {
			req.body.id = req.body.id.toString()
		}
		req.checkBody('tenant_code')
			.notEmpty()
			.withMessage('tenant_code is required for multi-tenant isolation')
			.isString()
			.withMessage('tenant_code must be a string')
		req.checkBody('organization_code')
			.notEmpty()
			.withMessage('organization_code is required')
			.isString()
			.withMessage('organization_code must be a string')
		req.checkBody('id').notEmpty().withMessage('id is required').isString().withMessage('id must be a string')
	},
	/**
	 * Validates internal API call for deleting a user
	 * Called from user service to mentoring service
	 */
	delete: (req) => {
		if (req.body && typeof req.body.id === 'number') {
			req.body.id = req.body.id.toString()
		}
		req.checkBody('tenant_code')
			.notEmpty()
			.withMessage('tenant_code is required for multi-tenant isolation')
			.isString()
			.withMessage('tenant_code must be a string')
		req.checkBody('id').notEmpty().withMessage('id is required').isString().withMessage('id must be a string')
	},
}
