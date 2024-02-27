const common = require('@constants/common')

const isAMentor = (roles) => {
	return roles.some((role) => role.title == common.MENTOR_ROLE)
}
/**
 * validateRoleAccess.
 * @method
 * @name validateRoleAccess
 * @param {Array} roles - roles array.
 * @param {String} requiredRole - role to check.
 * @returns {Number} - checksum key.
 */

const validateRoleAccess = (roles, requiredRoles) => {
	if (!roles || roles.length === 0) return false

	if (!Array.isArray(requiredRoles)) {
		requiredRoles = [requiredRoles]
	}

	// Check the type of the first element.
	const firstElementType = typeof roles[0]
	if (firstElementType === 'object') {
		return roles.some((role) => requiredRoles.includes(role.title))
	} else {
		return roles.some((role) => requiredRoles.includes(role))
	}
}

const role = {
	isAMentor,
	validateRoleAccess,
}

module.exports = role
