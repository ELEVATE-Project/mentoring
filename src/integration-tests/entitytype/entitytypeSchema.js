const createEntitySchema = {
	type: 'object',
	properties: {
		responseCode: {
			type: 'string',
		},
		message: {
			type: 'string',
		},
		result: {
			type: 'object',
			properties: {
				allow_custom_entities: {
					type: 'boolean',
				},
				has_entities: {
					type: 'boolean',
				},
				id: {
					type: 'integer',
				},
				value: {
					type: 'string',
				},
				label: {
					type: 'string',
				},
				status: {
					type: 'string',
				},
				allow_filtering: {
					type: 'boolean',
				},
				data_type: {
					type: 'string',
				},
				created_by: {
					type: 'integer',
				},
				updated_by: {
					type: 'integer',
				},
				org_id: {
					type: 'integer',
				},
				updated_at: {
					type: 'string',
				},
				created_at: {
					type: 'string',
				},
				parent_id: {
					type: 'null',
				},
				model_names: {
					type: 'null',
				},
				deleted_at: {
					type: 'null',
				},
			},
			required: [
				'allow_custom_entities',
				'has_entities',
				'id',
				'value',
				'label',
				'status',
				'allow_filtering',
				'data_type',
				'created_by',
				'updated_by',
				'org_id',
				'updated_at',
				'created_at',
				'parent_id',
				'model_names',
				'deleted_at',
			],
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

const readEntityTypeSchema = {
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
			items: {
				type: 'object',
				properties: {
					value: {
						type: 'string',
					},
					label: {
						type: 'string',
					},
					id: {
						type: 'integer',
					},
				},
				required: ['value', 'label', 'id'],
			},
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

const readEntityTypeWithEntitiesSchema = {
	type: 'object',
	properties: {
		responseCode: {
			type: 'string',
		},
		message: {
			type: 'string',
		},
		result: {
			type: 'object',
			properties: {
				entity_types: {
					type: 'array',
					items: {
						$ref: '#/definitions/entityType',
					},
				},
			},
			required: ['entity_types'],
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
	definitions: {
		entityType: {
			type: 'object',
			properties: {
				id: { type: 'integer' },
				value: { type: 'string' },
				label: { type: 'string' },
				status: { type: 'string' },
				created_by: { type: 'integer' },
				updated_by: { type: ['integer', 'null'] },
				allow_filtering: { type: 'boolean' },
				data_type: { type: 'string' },
				org_id: { type: 'integer' },
				parent_id: { type: ['null', 'integer'] },
				allow_custom_entities: { type: 'boolean' },
				has_entities: { type: 'boolean' },
				model_names: {
					type: 'array',
					items: { type: 'string' },
				},
				created_at: { type: 'string' },
				updated_at: { type: 'string' },
				deleted_at: { type: 'null' },
				entities: {
					type: 'array',
					items: {
						$ref: '#/definitions/entity',
					},
				},
			},
			required: [
				'id',
				'value',
				'label',
				'status',
				'created_by',
				'updated_by',
				'allow_filtering',
				'data_type',
				'org_id',
				'parent_id',
				'allow_custom_entities',
				'has_entities',
				'model_names',
				'created_at',
				'updated_at',
				'deleted_at',
				'entities',
			],
		},
		entity: {
			type: 'object',
			properties: {
				id: { type: 'integer' },
				entity_type_id: { type: 'integer' },
				value: { type: 'string' },
				label: { type: 'string' },
				status: { type: 'string' },
				type: { type: 'string' },
				created_by: { type: 'integer' },
				updated_by: { type: ['integer', 'null'] },
				created_at: { type: 'string' },
				updated_at: { type: 'string' },
				deleted_at: { type: 'null' },
			},
			required: [
				'id',
				'entity_type_id',
				'value',
				'label',
				'status',
				'type',
				'created_by',
				'updated_by',
				'created_at',
				'updated_at',
				'deleted_at',
			],
		},
	},
}

const deleteEntitySchema = {
	type: 'object',
	properties: {
		responseCode: {
			type: 'string',
			enum: ['OK'],
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
					format: 'uuid',
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
	createEntitySchema,
	readEntityTypeSchema,
	readEntityTypeWithEntitiesSchema,
	deleteEntitySchema,
}
