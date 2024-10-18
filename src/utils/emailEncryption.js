'use strict'
const crypto = require('crypto')

const secretKey = Buffer.from(process.env.EMAIL_ID_ENCRYPTION_KEY, 'hex')
const fixedIV = Buffer.from(process.env.EMAIL_ID_ENCRYPTION_IV, 'hex')
const algorithm = process.env.EMAIL_ID_ENCRYPTION_ALGORITHM

const isHex = (str) => /^[0-9a-fA-F]+$/.test(str)

const encrypt = (plainTextEmail) => {
	try {
		const cipher = crypto.createCipheriv(algorithm, secretKey, fixedIV)
		return cipher.update(plainTextEmail, 'utf-8', 'hex') + cipher.final('hex')
	} catch (err) {
		console.log(err)
		throw err
	}
}

const decrypt = async (encryptedEmail) => {
	try {
		const decipher = crypto.createDecipheriv(algorithm, secretKey, fixedIV)
		return decipher.update(encryptedEmail, 'hex', 'utf-8') + decipher.final('utf-8')
	} catch (err) {
		console.log(err)
		throw err
	}
}

async function decryptAndValidate(data) {
	try {
		const decipher = crypto.createDecipheriv(algorithm, secretKey, fixedIV)
		return decipher.update(data, 'hex', 'utf-8') + decipher.final('utf-8')
	} catch (err) {
		return false
	}
}

const emailEncryption = { encrypt, decrypt, decryptAndValidate }

module.exports = emailEncryption
