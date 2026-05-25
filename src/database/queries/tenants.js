'use strict'

const Tenant = require('@database/models/index').Tenant
const { UniqueConstraintError } = require('sequelize')

module.exports = class TenantQueries {
	static async findByCode(code) {
		try {
			return await Tenant.findOne({
				where: { code },
				raw: true,
			})
		} catch (error) {
			throw error
		}
	}

	static async upsert(data) {
		try {
			const [tenant, created] = await Tenant.findOrCreate({
				where: { code: data.code },
				defaults: data,
			})
			return { tenant: tenant.get({ plain: true }), created }
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				const existing = await Tenant.findOne({ where: { code: data.code }, raw: true })
				return { tenant: existing, created: false }
			}
			throw error
		}
	}

	static async update(code, data) {
		try {
			const [rowsAffected] = await Tenant.update(data, {
				where: { code },
			})
			return rowsAffected > 0 ? 'TENANT_UPDATED' : 'TENANT_NOT_FOUND'
		} catch (error) {
			throw error
		}
	}
}
