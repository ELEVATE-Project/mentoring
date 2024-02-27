// utils.js

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The string to capitalize.
 * @returns {string} Returns the capitalized string.
 */
exports.capitalize = (str) => {
	return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Checks if a value is numeric.
 * @param {any} value - The value to check.
 * @returns {boolean} Returns true if the value is numeric, otherwise false.
 */
exports.isNumeric = (value) => {
	return !isNaN(parseFloat(value)) && isFinite(value)
}

/**
 * Deletes specified properties from an object.
 * @param {Object} obj - The object from which properties will be deleted.
 * @param {string[]} propertiesToDelete - An array of property names to delete.
 * @returns {Object} Returns a new object with specified properties deleted.
 */
exports.deleteProperties = (obj, propertiesToDelete) => {
	try {
		return Object.keys(obj).reduce((result, key) => {
			if (!propertiesToDelete.includes(key)) {
				result[key] = obj[key]
			}
			return result
		}, {})
	} catch (error) {
		return obj
	}
}
