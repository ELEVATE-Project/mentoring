const reActivateSchema = {
	type: 'object',
	properties: {
		responseCode: {
			type: 'string',
		},
		message: {
			type: 'string',
		},
		result: {
			type: 'array',
			items: {},
		},
		meta: {
			type: 'object',
			properties: {
				formsVersion: {
					type: 'array',
					items: {},
				},
				correlation: {
					type: 'string',
				},
				meetingPlatform: {
					type: 'string',
				},
			},
			required: ['formsVersion', 'correlation', 'meetingPlatform'],
		},
	},
	required: ['responseCode', 'message', 'result', 'meta'],
}

module.exports = {
	reActivateSchema,
}
