'use strict'
const OrganizationExtension = require('@database/models/index').OrganizationExtension
const common = require('@constants/common')

module.exports = class OrganizationExtensionQueries {
	static async upsert(data, tenantCode) {
		try {
			if (!data.organization_id) throw new Error('organization_id Missing')
			data.tenant_code = tenantCode
			const [orgPolicies] = await OrganizationExtension.upsert(data, {
				returning: true,
				where: {
					organization_id: data.organization_id,
					tenant_code: tenantCode,
				},
			})
			return orgPolicies
		} catch (error) {
			throw new Error(`Error creating/updating organisation extension: ${error.message}`)
		}
	}

	static async getById(orgId, tenantCode) {
		try {
			const orgPolicies = await OrganizationExtension.findOne({
				where: {
					organization_id: orgId,
					tenant_code: tenantCode,
				},
				raw: true,
			})
			return orgPolicies
		} catch (error) {
			throw new Error(`Error fetching organisation extension: ${error.message}`)
		}
	}

	/**
	 * Find or insert organization extension data based on organizationId.
	 *
	 * @param {string} organizationId - The organization ID to search or insert.
	 * @returns {Promise<>} - The found or inserted organization extension data.
	 * @throws {Error} If organizationId is missing or if an error occurs during the operation.
	 */

	static async findOrInsertOrganizationExtension(organizationId, organization_name, tenantCode) {
		try {
			if (!organizationId) {
				throw new Error('organization Id Missing')
			}

			const data = common.getDefaultOrgPolicies()
			data.organization_id = organizationId
			data.name = organization_name
			data.tenant_code = tenantCode

			// Try to find the data, and if it doesn't exist, create it
			const [orgPolicies, created] = await OrganizationExtension.findOrCreate({
				where: {
					organization_id: organizationId,
					tenant_code: tenantCode,
				},
				defaults: data,
			})

			return orgPolicies.dataValues
		} catch (error) {
			throw new Error(`Error finding/inserting organisation extension: ${error.message}`)
		}
	}

	static async findAll(filter, tenantCode, options = {}) {
		try {
			filter.tenant_code = tenantCode
			const orgExtensions = await OrganizationExtension.findAll({
				where: filter,
				...options,
				raw: true,
			})
			return orgExtensions
		} catch (error) {
			throw new Error(`Error fetching organisation extension: ${error.message}`)
		}
	}
	static async findOne(filter, tenantCode, options = {}) {
		try {
			filter.tenant_code = tenantCode
			const orgExtension = await OrganizationExtension.findOne({
				where: filter,
				...options,
				raw: true,
			})
			return orgExtension
		} catch (error) {
			throw new Error(`Error fetching organisation extension: ${error.message}`)
		}
	}

	static async create(data, tenantCode, options = {}) {
		try {
			data.tenant_code = tenantCode
			const newOrgExtension = await OrganizationExtension.create(data, options)
			return newOrgExtension
		} catch (error) {
			throw error
		}
	}

	static async update(data, organization_id, tenantCode) {
		try {
			if (!organization_id) {
				throw new Error('Missing organization_id in data')
			}
			const [updatedRecords] = await OrganizationExtension.update(data, {
				where: {
					organization_id: organization_id,
					tenant_code: tenantCode,
				},
				returning: true,
			})
			return updatedRecords
		} catch (error) {
			throw new Error(`Error updating organization extension: ${error.message}`)
		}
	}

	static async getAllByIds(ids) {
		try {
			const filterClause = `organization_id IN (${ids.map((id) => `'${id}'`).join(',')})`

			const query = `
				SELECT *
				FROM ${common.materializedViewsPrefix + MenteeExtension.tableName}
				WHERE
					${filterClause}
				`

			const results = await Sequelize.query(query, {
				type: QueryTypes.SELECT,
			})
			return results
		} catch (error) {
			throw error
		}
	}
}
