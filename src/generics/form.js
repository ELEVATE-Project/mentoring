const formQueries = require('../database/queries/form')
async function getAllFormsVersion(tenantCode) {
	try {
		return await formQueries.findAllTypeFormVersion(tenantCode)
	} catch (error) {
		console.error(error)
	}
}
module.exports = { getAllFormsVersion }
