const requestSessionsService = require('@services/requestSessions')

module.exports = class requestsSessions {
	async create(req) {
		try {
			return await requestSessionsService.create(req.body, req.decodedToken.id, req.pageNo, req.pageSize)
		} catch (error) {
			return error
		}
	}
}
