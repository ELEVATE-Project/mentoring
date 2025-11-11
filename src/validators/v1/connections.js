module.exports = {
	initiate: (req) => {
		req.checkBody('user_id')
			.notEmpty()
			.withMessage('user_id is required')
			.isString()
			.withMessage('user_id must be a string')

		req.checkBody('message')
			.notEmpty()
			.withMessage('message is required')
			.isString()
			.withMessage('message must be a string')
	},

	pending: (req) => {},

	list: (req) => {},

	getInfo: (req) => {
		req.checkBody('user_id')
			.notEmpty()
			.withMessage('user_id is required')
			.isString()
			.withMessage('user_id must be a string')
	},

	accept: (req) => {
		req.checkBody('user_id')
			.notEmpty()
			.withMessage('user_id is required')
			.isString()
			.withMessage('user_id must be a string')
	},

	reject: (req) => {
		req.checkBody('user_id')
			.notEmpty()
			.withMessage('user_id is required')
			.isString()
			.withMessage('user_id must be a string')
	},
	checkConnection: (req) => {
		req.checkBody('friend_id')
			.notEmpty()
			.withMessage('friend_id is required')
			.isString()
			.withMessage('friend_id must be a string')
	},
}
