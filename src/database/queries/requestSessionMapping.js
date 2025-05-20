const requestSessionMapping = require('@database/models/index').SessionRequestMapping

exports.addSessionRequest = async (requesteeId, requestId) => {
	try {
		const SessionRequestMappingData = [
			{
				requestee_id: requesteeId,
				session_request_id: requestId,
			},
		]

		const requestResult = await requestSessionMapping.bulkCreate(SessionRequestMappingData)

		return requestResult
	} catch (error) {
		throw error
	}
}

exports.getSessionsMapping = async (userId) => {
	try {
		return await requestSessionMapping.findAll({
			where: {
				requestee_id: userId,
			},
			raw: true,
		})
	} catch (error) {
		throw error
	}
}
