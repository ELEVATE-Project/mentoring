'use strict'

const { Op } = require('sequelize')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const cacheHelper = require('@generics/cacheHelper')

/**
 * Converts an array of numeric org IDs (as returned by the User Service)
 * to their corresponding org codes using the local organisation_extensions table.
 *
 * Cache strategy: individual Redis key per org ID (tenant:${tenantCode}:orgIdCode:${orgId}).
 * Only uncached IDs hit the DB. Kafka consumer invalidates entries on org create/update/deactivate.
 *
 * @param {Array<number|string>} orgIds  - Numeric org IDs e.g. [1, 2, 3]
 * @param {string}               tenantCode
 * @returns {Promise<string[]>}          - Org codes e.g. ['DEFAULT', 'sunbird']
 */
async function convertOrgIdsToOrgCodes(orgIds, tenantCode) {
	if (!orgIds?.length) return []

	const normalizedIds = [...new Set(orgIds.map(String))]

	// Check cache for all IDs in parallel
	const cacheResults = await Promise.all(normalizedIds.map((id) => cacheHelper.orgIdCode.get(tenantCode, id)))

	const idToCode = {}
	const uncachedIds = []

	normalizedIds.forEach((id, i) => {
		if (cacheResults[i] !== null && cacheResults[i] !== undefined) {
			idToCode[id] = cacheResults[i]
		} else {
			uncachedIds.push(id)
		}
	})

	// Fetch only uncached IDs from DB
	if (uncachedIds.length > 0) {
		const rows = await organisationExtensionQueries.findAll(
			{
				organization_id: { [Op.in]: uncachedIds },
				tenant_code: tenantCode,
			},
			{ attributes: ['organization_id', 'organization_code'] }
		)

		// Cache each fetched entry individually and build local map
		await Promise.all(
			rows.map((r) => {
				const id = String(r.organization_id)
				idToCode[id] = r.organization_code
				return cacheHelper.orgIdCode.set(tenantCode, id, r.organization_code)
			})
		)
	}

	const codes = orgIds.map((id) => idToCode[String(id)]).filter(Boolean)

	const missing = orgIds.filter((id) => !idToCode[String(id)])
	if (missing.length) {
		console.warn(`convertOrgIdsToOrgCodes: no org_code found for IDs [${missing}] in tenant ${tenantCode}`)
	}

	return codes
}

module.exports = { convertOrgIdsToOrgCodes }
