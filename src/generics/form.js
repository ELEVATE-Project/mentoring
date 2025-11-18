const formQueries = require('../database/queries/form')
const utils = require('@generics/utils')
async function getAllFormsVersion() {
	try {
		let forms = await utils.internalGet('forms')
		if (forms) {
			return forms
		} else {
			let formData = await formQueries.findAllTypeFormVersion()
			await utils.internalSet('forms', formData)
			return await utils.internalGet('forms')
		}
	} catch (error) {
		console.error(error)
	}
}
module.exports = { getAllFormsVersion }
