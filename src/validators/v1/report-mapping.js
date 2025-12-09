module.exports = {
	create: (req) => {
		req.checkBody('report_code')
			.notEmpty()
			.withMessage('report_code field is empty')
			.matches(/^[a-z_]+$/)
			.withMessage('report_code should not contain any spaces')
		req.checkBody('role_title')
			.notEmpty()
			.withMessage('role_title field is empty')
			.matches(/^[a-z_]+$/)
			.withMessage('role_title should not contain any spaces')
	},

	read: (req) => {
		req.checkQuery('code')
			.notEmpty()
			.withMessage('code is required')
			.matches(/^[a-z_]+$/)
			.withMessage('code should not contain any spaces')
	},

	update: (req) => {
		req.checkQuery('id').notEmpty().withMessage('id is required')

		req.checkBody('report_code')
			.optional()
			.matches(/^[a-z_]+$/)
			.withMessage('report_code should not contain any spaces')
		req.checkBody('role_title')
			.optional()
			.matches(/^[a-z_]+$/)
			.withMessage('role_title should not contain any spaces')
	},

	delete: (req) => {
		req.checkQuery('id').notEmpty().withMessage('id is required')
	},
}
