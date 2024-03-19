'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		await queryInterface.bulkUpdate(
			'forms',
			{
				data: JSON.stringify({
					fields: {
						forms: [
							{
								name: 'Google meet',
								hint: 'To use google meet for your meeting, schedule a meeting on google meet and add meeting link below.',
								value: 'Gmeet',
								form: {
									controls: [
										{
											name: 'link',
											label: 'Meet link',
											value: '',
											type: 'text',
											platformPlaceHolder: 'Eg: https://meet.google.com/xxx-xxxx-xxx',
											errorMessage: {
												required: 'Please provide a meet link',
												pattern: 'Please provide a valid meet link',
											},
											validators: {
												required: true,
												pattern: '^https://meet.google.com/[a-z0-9-?/=]+$',
											},
										},
									],
								},
							},
							{
								name: 'Zoom',
								hint: 'To use zoom for your meeting, schedule a meeting on zoom and add meeting details below.',
								value: 'Zoom',
								form: {
									controls: [
										{
											name: 'link',
											label: 'Zoom link',
											value: '',
											class: 'ion-no-margin',
											type: 'text',
											platformPlaceHolder: 'Eg: https://us05web.zoom.us/j/xxxxxxxxxx',
											position: 'floating',
											errorMessage: {
												required: 'Please provide a meeting link',
												pattern: 'Please provide a valid meeting link',
											},
											validators: {
												required: true,
												pattern:
													'^https?://(?:[a-z0-9-.]+)?zoom.(?:us|com.cn)/(?:j|my)/[0-9a-zA-Z?=.]+$',
											},
										},
										{
											name: 'meetingId',
											label: 'Meeting ID',
											value: '',
											class: 'ion-no-margin',
											type: 'number',
											platformPlaceHolder: 'Eg: 123 456 7890',
											position: 'floating',
											errorMessage: {
												required: 'Please provide a meeting ID',
											},
											validators: {
												required: true,
												maxLength: 11,
											},
										},
										{
											name: 'password',
											label: 'Passcode',
											value: '',
											type: 'text',
											platformPlaceHolder: 'Eg: aBc1de',
											errorMessage: {
												required: 'Please provide a valid passcode',
											},
											validators: {
												required: true,
											},
										},
									],
								},
							},
							{
								name: 'WhatsApp',
								hint: 'To use whatsapp for your meeting(32 people or less, create a call link on WhatsApp and add a link below.)',
								value: 'Whatsapp',
								form: {
									controls: [
										{
											name: 'link',
											label: 'WhatsApp',
											value: '',
											type: 'text',
											platformPlaceHolder: 'Eg: https://call.whatsapp.com/voice/xxxxxxxxxxxx',
											errorMessage: {
												required: 'Please provide a WhatsApp link.',
												pattern: 'Please provide a valid WhatsApp link.',
											},
											validators: {
												required: true,
												pattern:
													'^https?://(?:[a-z0-9-.]+)?whatsapp.com/[voicedeo]+/[0-9a-zA-Z?=./]+$',
											},
										},
									],
								},
							},
						],
					},
					template_name: 'defaultTemplate',
				}),

				updated_at: new Date(),
			},
			{ type: 'platformApp', sub_type: 'platformAppForm', organization_id: defaultOrgId }
		)
	},

	down: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}
		await queryInterface.bulkUpdate(
			'forms',

			{
				data: JSON.stringify({
					fields: {
						forms: [
							{
								name: 'Google meet',
								hint: 'To use google meet for your meeting, schedule a meeting on google meet and add meeting link below.',
								value: 'Gmeet',
								form: {
									controls: [
										{
											name: 'link',
											label: 'Meet link',
											value: '',
											type: 'text',
											platformPlaceHolder: 'Eg: https://meet.google.com/xxx-xxxx-xxx',
											errorMessage: {
												required: 'Please provide a meet link',
												pattern: 'Please provide a valid meet link',
											},
											validators: {
												required: true,
												pattern: '^https://meet.google.com/[a-z0-9-]+$',
											},
										},
									],
								},
							},
							{
								name: 'Zoom',
								hint: 'To use zoom for your meeting, schedule a meeting on zoom and add meeting details below.',
								value: 'Zoom',
								form: {
									controls: [
										{
											name: 'link',
											label: 'Zoom link',
											value: '',
											class: 'ion-no-margin',
											type: 'text',
											platformPlaceHolder: 'Eg: https://us05web.zoom.us/j/xxxxxxxxxx',
											position: 'floating',
											errorMessage: {
												required: 'Please provide a meeting link',
												pattern: 'Please provide a valid meeting link',
											},
											validators: {
												required: true,
												pattern:
													'^https?://(?:[a-z0-9-.]+)?zoom.(?:us|com.cn)/(?:j|my)/[0-9a-zA-Z?=.]+$',
											},
										},
										{
											name: 'meetingId',
											label: 'Meeting ID',
											value: '',
											class: 'ion-no-margin',
											type: 'number',
											platformPlaceHolder: 'Eg: 123 456 7890',
											position: 'floating',
											errorMessage: {
												required: 'Please provide a meeting ID',
											},
											validators: {
												required: true,
												maxLength: 11,
											},
										},
										{
											name: 'password',
											label: 'Passcode',
											value: '',
											type: 'text',
											platformPlaceHolder: 'Eg: aBc1de',
											errorMessage: {
												required: 'Please provide a valid passcode',
											},
											validators: {
												required: true,
											},
										},
									],
								},
							},
							{
								name: 'WhatsApp',
								hint: 'To use whatsapp for your meeting(32 people or less, create a call link on WhatsApp and add a link below.)',
								value: 'Whatsapp',
								form: {
									controls: [
										{
											name: 'link',
											label: 'WhatsApp',
											value: '',
											type: 'text',
											platformPlaceHolder: 'Eg: https://call.whatsapp.com/voice/xxxxxxxxxxxx',
											errorMessage: {
												required: 'Please provide a WhatsApp link.',
												pattern: 'Please provide a valid WhatsApp link.',
											},
											validators: {
												required: true,
												pattern:
													'^https?://(?:[a-z0-9-.]+)?whatsapp.com/[voicedeo]+/[0-9a-zA-Z?=./]+$',
											},
										},
									],
								},
							},
						],
					},
					template_name: 'defaultTemplate',
				}),

				updated_at: new Date(),
			},

			{ type: 'platformApp', sub_type: 'platformAppForm', organization_id: defaultOrgId }
		)
	},
}
