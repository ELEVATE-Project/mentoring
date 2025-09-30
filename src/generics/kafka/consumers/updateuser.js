const userRequest = require('@services/users')

var messageReceived = function (message) {
	return new Promise(async function (resolve, reject) {
		try {
			message.userId = message.entityId.toString()
			message.tenantCode = message.oldValues?.tenant_code
			const response = await userRequest.update(message)
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
