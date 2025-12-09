module.exports = {
	filterList: (req) => {
		req.checkQuery('filter_type')
			.notEmpty()
			.withMessage('filter_type query is empty')
			.isIn(['session'])
			.withMessage('filterType is invalid')

		req.checkQuery('report_filter').optional().isIn(['true', 'false']).withMessage('report_type is invalid')
	},

	reportData: (req) => {
		req.checkQuery('pageNo').optional().isInt({ min: 1 }).withMessage('pageNo must be a positive integer')

		req.checkQuery('Limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer')

		req.checkQuery('report_code')
			.notEmpty()
			.withMessage('report_code is required')
			.matches(/^[a-z_]+$/)
			.withMessage('report_code is invalid, must not contain spaces')

		req.checkQuery('report_role')
			.notEmpty()
			.withMessage('report_role is required')
			.matches(/^[a-z_]+$/)
			.withMessage('report_role is invalid, must not contain spaces')

		req.checkQuery('start_date')
			.notEmpty()
			.withMessage('start_date is required')
			.matches(/^\d+$/)
			.withMessage('start_date must be in epoch format (non-negative integer)')

		req.checkQuery('end_date')
			.notEmpty()
			.withMessage('end_date is required')
			.matches(/^\d+$/)
			.withMessage('end_date must be in epoch format (non-negative integer)')

		req.checkQuery('session_type').notEmpty().withMessage('session_type is required')

		req.checkQuery('entities_value')
			.trim()
			.optional()
			.isString()
			.withMessage('entities_value must be an string')
			.matches(/^[a-z_]*$/)
			.withMessage('entities_value is invalid, must not contain spaces')

		req.checkQuery('sort_column')
			.optional()
			.isString()
			.withMessage('sort_column must be a string')
			.matches(/^[a-z_]*$/)
			.withMessage('sort_column is invalid, must not contain spaces')

		req.checkQuery('sort_type')
			.optional()
			.isString()
			.withMessage('sort_column must be a string')
			.matches(/^[A-Za-z]*$/)
			.withMessage('sort_column is invalid, must be')

		req.checkBody('filters')
			.optional()
			.custom((value) => {
				let filters
				try {
					filters = typeof value === 'string' ? JSON.parse(value) : value
				} catch (err) {
					throw new Error('filters must be a valid JSON string or object')
				}

				if (typeof filters !== 'object' || Array.isArray(filters)) {
					throw new Error('filters must be an object')
				}

				for (const key in filters) {
					if (!Array.isArray(filters[key])) {
						throw new Error(`filters.${key} must be an array`)
					}
					if (filters[key].length === 0) {
						throw new Error(`filters.${key} cannot be an empty array`)
					}
					if (!filters[key].every((item) => typeof item === 'string')) {
						throw new Error(`filters.${key} must contain only strings`)
					}
				}
				return true
			})

		req.checkBody('search')
			.optional()
			.custom((value) => {
				let search
				try {
					search = typeof value === 'string' ? JSON.parse(value) : value
				} catch (err) {
					throw new Error('search must be a valid JSON string or object')
				}

				if (typeof search !== 'object' || Array.isArray(search)) {
					throw new Error('search must be an object')
				}

				for (const key in search) {
					if (!Array.isArray(search[key])) {
						throw new Error(`search.${key} must be an array`)
					}
					if (search[key].length === 0) {
						throw new Error(`search.${key} cannot be an empty array`)
					}
				}
				return true
			})

		req.checkQuery('download_csv')
			.optional()
			.isIn(['true', 'false'])
			.withMessage('download_csv must be "true" or "false"')
	},

	create: (req) => {
		req.checkBody('code')
			.notEmpty()
			.withMessage('code field is empty')
			.matches(/^[a-z_]+$/)
			.withMessage('code should not contain any spaces')

		req.checkBody('title')
			.notEmpty()
			.withMessage('title field is empty')
			.matches(/^[A-Za-z ]+$/)
			.withMessage('title can only contain alphabetic characters and spaces')

		req.checkBody('description').notEmpty().withMessage('description field is empty')

		req.checkBody('report_type_title')
			.notEmpty()
			.withMessage('report_type_title field is required')
			.matches(/^[a-z_]+$/)
			.withMessage('report_type_title should not contain any spaces')

		req.checkBody('config')
			.notEmpty()
			.withMessage('config field is required')
			.custom((config) => {
				if (!Array.isArray(config.columns)) {
					throw new Error('config.columns should be an array')
				}

				// Validate each column object
				config.columns.forEach((column, index) => {
					if (!column.key || typeof column.key !== 'string') {
						throw new Error(`Column at index ${index} must have a valid "key" as a string`)
					}
					if (!column.label || typeof column.label !== 'string') {
						throw new Error(`Column at index ${index} must have a valid "label" as a string`)
					}
					if (typeof column.sort !== 'boolean') {
						throw new Error(`Column at index ${index} must have "sort" as a boolean`)
					}
					if (typeof column.filter !== 'boolean') {
						throw new Error(`Column at index ${index} must have "filter" as a boolean`)
					}
					if (column.defaultValues && !Array.isArray(column.defaultValues)) {
						throw new Error(`Column at index ${index} must have "defaultValues" as an array if provided`)
					}
				})

				return true
			})

		req.checkBody('organization_id').optional().notEmpty().isInt().withMessage('organization_id field is empty')
	},

	read: (req) => {
		req.checkQuery('id').notEmpty().withMessage('id is required')
	},

	update: (req) => {
		req.checkQuery('id').notEmpty().withMessage('id is required')

		req.checkBody('code')
			.optional()
			.withMessage('code field is empty')
			.matches(/^[a-z_]+$/)
			.withMessage('code should not contain any spaces')

		req.checkBody('title')
			.optional()
			.withMessage('title field is empty')
			.matches(/^[A-Za-z ]+$/)
			.withMessage('title can only contain alphabetic characters and spaces')

		req.checkBody('description').optional().notEmpty().withMessage('description field is empty')

		req.checkBody('report_type_title')
			.optional()
			.withMessage('report_type_title field is empty')
			.matches(/^[a-z_]+$/)
			.withMessage('report_type_title should not contain any spaces')

		req
			.checkBody('config')
			.optional()
			.custom((config) => {
				if (!Array.isArray(config.columns)) {
					throw new Error('config.columns should be an array')
				}

				// Validate each column object
				config.columns.forEach((column, index) => {
					if (!column.key || typeof column.key !== 'string') {
						throw new Error(`Column at index ${index} must have a valid "key" as a string`)
					}
					if (!column.label || typeof column.label !== 'string') {
						throw new Error(`Column at index ${index} must have a valid "label" as a string`)
					}
					if (typeof column.sort !== 'boolean') {
						throw new Error(`Column at index ${index} must have "sort" as a boolean`)
					}
					if (typeof column.filter !== 'boolean') {
						throw new Error(`Column at index ${index} must have "filter" as a boolean`)
					}
					if (column.defaultValues && !Array.isArray(column.defaultValues)) {
						throw new Error(`Column at index ${index} must have "defaultValues" as an array if provided`)
					}
				})

				return true
			}),
			req.checkBody('organization_id').optional().notEmpty().isInt().withMessage('organization_id field is empty')
	},

	delete: (req) => {
		req.checkQuery('id').notEmpty().withMessage('id is required')
	},
}
