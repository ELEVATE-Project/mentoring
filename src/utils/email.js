// emailUtils.js

/**
 * Compose email body by replacing placeholders with provided parameters.
 * @param {string} body - The email body with placeholders.
 * @param {object} params - The parameters to replace the placeholders.
 * @returns {string} The composed email body.
 */
const composeEmailBody = (body, params) => {
	return body.replace(/{([^{}]*)}/g, (a, b) => {
		var r = params[b]
		return typeof r === 'string' || typeof r === 'number' ? r : a
	})
}

/**
 * Extract email template based on conditions.
 * @param {string} input - The email template input.
 * @param {Array} conditions - The conditions to determine which parts of the template to extract.
 * @returns {string} The extracted email template.
 */
const extractEmailTemplate = (input, conditions) => {
	const allConditionsRegex = /{{(.*?)}}(.*?){{\/\1}}/g
	let result = input

	for (const match of input.matchAll(allConditionsRegex)) {
		result = conditions.includes(match[1]) ? result.replace(match[0], match[2]) : result.replace(match[0], '')
	}

	return result
}

const email = {
	composeEmailBody,
	extractEmailTemplate,
}

module.exports = email
