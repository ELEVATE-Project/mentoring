module.exports = {
	create: (req) => {
		req.checkBody('title')
			.trim()
			.notEmpty()
			.withMessage('title field is empty')
			.matches(/^[a-z_]+$/)
			.withMessage('title should not contain any spaces')

		req.checkBody('label')
			.trim()
			.notEmpty()
			.withMessage('label field is empty')
			.matches(/^[A-Za-z0-9 ]+$/)
			.withMessage('label is invalid')

		req.checkBody('scope')
			.trim()
			.notEmpty()
			.withMessage('scope field is empty')
			.matches(/^[A-Z]+$/)
			.withMessage('scope should not contain space , scope is invalid')

		req.checkBody('organization_id')
			.trim()
			.notEmpty()
			.withMessage('organization_id field is empty')
			.matches(/^[0-9]+$/)
			.withMessage('organization_id should not contain space , scope is invalid')
	},

	read: (req) => {
		req.checkQuery('title').notEmpty().withMessage('title is required')
	},

	update: (req) => {
		req.checkQuery('title').notEmpty().withMessage('title is required')

		req.checkBody('label')
			.optional()
			.withMessage('label field is empty')
			.matches(/^[A-Za-z0-9 ]+$/)
			.withMessage('label is invalid')

		req.checkBody('scope')
			.optional()
			.withMessage('scope field is empty')
			.matches(/^[A-Z]+$/)
			.withMessage('scope should not contain space , scope is invalid')

		req.checkBody('organization_id')
			.optional()
			.withMessage('organization_id field is empty')
			.matches(/^[0-9]+$/)
			.withMessage('organization_id should not contain space , scope is invalid')
	},

	delete: (req) => {
		req.checkQuery('title').notEmpty().withMessage('title is required')
	},
}
