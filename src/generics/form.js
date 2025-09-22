const formQueries = require('../database/queries/form')
const { getDefaults } = require('@helpers/getDefaultOrgId')

async function getAllFormsVersion(tenantCode, orgCode) {
	try {
		if (!tenantCode || !orgCode) {
			const defaults = await getDefaults()
			tenantCode = tenantCode || defaults?.tenantCode
			orgCode = orgCode || defaults?.orgCode
		}
		return await formQueries.findAllTypeFormVersion(tenantCode, orgCode)
	} catch (error) {
		return error
	}
}
module.exports = { getAllFormsVersion }
