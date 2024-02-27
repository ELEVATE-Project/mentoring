// utils.js
const md5 = require('md5')
const bcryptJs = require('bcryptjs')
const crypto = require('crypto')

/**
 * Generates a hash for the given string.
 * @param {string} str - The string to hash.
 * @returns {string} Returns the hashed string.
 */
const hash = (str) => {
	const salt = bcryptJs.genSaltSync(10)
	return bcryptJs.hashSync(str, salt)
}

/**
 * Generates an MD5 hash for the given string.
 * @param {value} value - The string to hash using MD5.
 * @returns {string} Returns the MD5 hashed string.
 */
const md5Hash = (value) => {
	return md5(value)
}

/**
 * Generates a checksum for the given query hash.
 * @param {string} queryHash - The query hash to generate the checksum for.
 * @returns {string} Returns the generated checksum.
 */
const generateCheckSum = (queryHash) => {
	const shasum = crypto.createHash('sha1')
	shasum.update(queryHash)
	return shasum.digest('hex')
}
module.exports = {
	hash,
	md5Hash,
	generateCheckSum,
}
