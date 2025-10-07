const userRequest = require('@services/users')

var messageReceived = function (message) {
	return new Promise(async function (resolve, reject) {
		try {
			message.userId = message.entityId.toString()
			message.tenantCode = message.oldValues?.tenant_code

			// Create a mock decodedToken for internal service call
			const mockDecodedToken = {
				id: message.userId,
				tenant_code: message.tenantCode,
				organization_id: message.organizations?.[0]?.id || null,
				organization_code: message.organizations?.[0]?.code || null,
			}

			const response = await userRequest.update(
				message,
				mockDecodedToken,
				message.userId,
				mockDecodedToken.organization_id,
				message.tenantCode
			)
			return resolve(response)
		} catch (error) {
			return reject(error)
		}
	})
}

var errorTriggered = function (error) {
	return new Promise(function (resolve, reject) {
		try {
			return resolve('Error Processed')
		} catch (error) {
			return reject(error)
		}
	})
}

module.exports = {
	messageReceived: messageReceived,
	errorTriggered: errorTriggered,
}
