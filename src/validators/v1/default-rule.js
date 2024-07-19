module.exports = {
	create: (req) => {
		req.checkBody('type')
			.isString()
			.notEmpty()
			.isIn(['session', 'mentor'])
			.withMessage(
				'The type field is required, must be a non-empty string, and must be either session or mentor.'
			)
		req.checkBody('target_field')
			.isString()
			.notEmpty()
			.withMessage('The target_field field is required and must be a non-empty string.')

		req.checkBody('is_target_from_sessions_mentor')
			.optional()
			.isBoolean()
			.withMessage('The is_target_from_sessions_mentor field must be a boolean if provided.')

		req.checkBody('requester_field')
			.isString()
			.notEmpty()
			.withMessage('The requester_field field is required and must be a non-empty string.')

		req.checkBody('field_configs')
			.custom((value) => {
				if (typeof value !== 'object' || Array.isArray(value) || value === null) {
					throw new Error('The field_configs field must be an object.')
				}
				return true
			})
			.optional()

		req.checkBody('operator')
			.isString()
			.notEmpty()
			.isIn([
				'equals',
				'notEquals',
				'contains',
				'containedBy',
				'overlap',
				'greaterThan',
				'lessThan',
				'greaterThanOrEqual',
				'lessThanOrEqual',
			])
			.withMessage(
				'The operator field is required, must be a non-empty string, and must be one of the following: equals, notEquals, contains, containedBy, overlap, greaterThan, lessThan, greaterThanOrEqual, or lessThanOrEqual.'
			)

		req.checkBody('requester_roles')
			.optional()
			.isArray()
			.withMessage('The requester_roles field is required and must be an array with at least one role.')
			.custom((roles) => roles.length >= 1)
			.withMessage('The requester_roles field must have at least one role.')
			.custom((roles) => roles.every((role) => typeof role === 'string'))
			.withMessage('All elements in the requester_roles array must be strings.')

		req.checkBody('requester_roles_config')
			.custom((value) => {
				if (typeof value !== 'object' || Array.isArray(value) || value === null) {
					throw new Error('The requester_roles_config field must be an object.')
				}
				return true
			})
			.optional()

		if (req.body.requester_roles_config) {
			req.checkBody('requester_roles_config.exclude')
				.notEmpty()
				.isBoolean()
				.withMessage('The requester_roles_config.exclude field must be a boolean if provided.')
		}
	},

	read: (req) => {
		try {
			req.checkParams('id').optional().isNumeric().withMessage('id param is invalid, must be an integer')
		} catch (error) {
			console.log(error)
		}
	},

	update: (req) => {
		try {
			req.checkBody('type')
				.isString()
				.notEmpty()
				.isIn(['session', 'mentor'])
				.withMessage(
					'The type field is required, must be a non-empty string, and must be either session or mentor.'
				)

			req.checkBody('target_field')
				.isString()
				.notEmpty()
				.withMessage('The target_field field is required and must be a non-empty string.')

			req.checkBody('is_target_from_sessions_mentor')
				.isBoolean()
				.withMessage('The is_target_from_sessions_mentor field must be a boolean if provided.')

			req.checkBody('requester_field')
				.isString()
				.notEmpty()
				.withMessage('The requester_field field is required and must be a non-empty string.')

			req.checkBody('field_configs')
				.custom((value) => {
					if (typeof value !== 'object' || Array.isArray(value) || value === null) {
						throw new Error('The field_configs field must be an object.')
					}
					return true
				})
				.optional()

			req.checkBody('operator')
				.optional()
				.isString()
				.notEmpty()
				.isIn([
					'equals',
					'notEquals',
					'contains',
					'containedBy',
					'overlap',
					'greaterThan',
					'lessThan',
					'greaterThanOrEqual',
					'lessThanOrEqual',
				])
				.withMessage(
					'The operator field is required, must be a non-empty string, and must be one of the following: equals, notEquals, contains, containedBy, overlap, greaterThan, lessThan, greaterThanOrEqual, or lessThanOrEqual.'
				)

			req.checkBody('requester_roles')
				.optional()
				.isArray({ min: 1 })
				.withMessage('The requester_roles field is required and must be an array with at least one role.')
				.custom((roles) => roles.every((role) => typeof role === 'string'))
				.withMessage('All elements in the requester_roles array must be strings.')

			req.checkBody('requester_roles_config')
				.custom((value) => {
					if (typeof value !== 'object' || Array.isArray(value) || value === null) {
						throw new Error('The requester_roles_config field must be an object.')
					}
					return true
				})
				.optional()

			if (req.body.requester_roles_config) {
				req.checkBody('requester_roles_config.exclude')
					.notEmpty()
					.isBoolean()
					.withMessage('The requester_roles_config.exclude field must be a boolean if provided.')
			}
		} catch (error) {
			console.log(error)
		}
	},

	delete: (req) => {
		try {
			req.checkParams('id')
				.notEmpty()
				.withMessage('id param is empty')
				.isNumeric()
				.withMessage('id param is invalid, must be an integer')
		} catch (error) {
			console.log(error)
		}
	},
}
