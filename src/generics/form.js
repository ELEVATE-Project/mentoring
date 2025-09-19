const formQueries = require('../database/queries/form')
async function getAllFormsVersion(tenantCode) {
	try {
		return await formQueries.findAllTypeFormVersion(tenantCode)
	} catch (error) {
		return error
	}
}
module.exports = { getAllFormsVersion }
