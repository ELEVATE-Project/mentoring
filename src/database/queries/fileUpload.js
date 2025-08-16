'use strict'
const FileUpload = require('../models/index').FileUpload

exports.create = async (data, tenantCode) => {
	try {
		data.tenantCode = tenantCode
		const createFileUpload = await FileUpload.create(data)
		const result = createFileUpload.get({ plain: true })
		return result
	} catch (error) {
		return error
	}
}

exports.findOne = async (filter, tenantCode, options = {}) => {
	try {
		return await FileUpload.findOne({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		return error
	}
}

exports.update = async (filter, tenantCode, update, options = {}) => {
	try {
		filter.tenant_code = tenantCode
		const [res] = await FileUpload.update(update, {
			where: filter,
			...options,
			individualHooks: true,
		})

		return res
	} catch (error) {
		return error
	}
}

exports.listUploads = async (page, limit, status, orgCode, tenantCode) => {
	try {
		let filterQuery = {
			where: { tenant_code: tenantCode },
			attributes: {
				exclude: ['created_at', 'updated_at', 'deleted_at', 'updated_by'],
			},
			offset: parseInt((page - 1) * limit, 10),
			limit: parseInt(limit, 10),
		}

		if (orgCode) {
			filterQuery.where.organization_code = orgCode
		}

		if (status) {
			filterQuery.where.status = status
		}

		const result = await FileUpload.findAndCountAll(filterQuery)
		const transformedResult = {
			count: result.count,
			data: result.rows.map((row) => {
				return row.get({ plain: true })
			}),
		}
		return transformedResult
	} catch (error) {
		return error
	}
}
