module.exports = {
	create: (req) => {
		req.checkBody('report_code')
			.notEmpty()
			.withMessage('report_code field is empty')
			.matches(/^[a-z_]+$/)
			.withMessage('report_code should not contain any spaces')
		req.checkBody('query')
			.notEmpty()
			.withMessage('query field is empty')
			.isString()
			.withMessage('query must be in string')
	},

	read: (req) => {
		req.checkQuery('code')
			.notEmpty()
			.withMessage('code is required')
			.matches(/^[a-z_]+$/)
			.withMessage('code should not contain any spaces')
	},

	update: (req) => {
		req.checkQuery('code').notEmpty().withMessage('code is required')

		req.checkBody('query')
			.optional()
			.withMessage('query field is empty')
			.isString()
			.withMessage('query should be in string')
	},

	delete: (req) => {
		req.checkQuery('id').notEmpty().withMessage('id is required')
	},
}
