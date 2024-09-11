const readline = require('readline')
const fs = require('fs')
const axios = require('axios')

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

let accessToken = ''
let adminAuthToken = ''
let organizationId = ''

const DEFAULT_MENTORING_DOMAIN = 'http://localhost:3569'
let MENTORING_DOMAIN = DEFAULT_MENTORING_DOMAIN

async function main() {
	try {
		await promptForDomain()
		await promptForAccessToken()
		await promptForAdminAuthToken()
		await promptForOrganizationId()
		return await readAndUpdateEntityType()
	} catch (error) {
		console.error('Error occurred:', error)
	} finally {
		rl.close()
	}
}

async function promptForDomain() {
	const domain = await promptQuestion(`Enter domain (default: ${DEFAULT_MENTORING_DOMAIN}): `)
	if (domain) {
		MENTORING_DOMAIN = domain
	}
	console.log(`Using domain: ${MENTORING_DOMAIN}`)
}

async function promptForAccessToken() {
	accessToken = await promptQuestion('Enter access token: ')
}

async function promptForAdminAuthToken() {
	adminAuthToken = await promptQuestion('Enter admin Auth Token: ')
}

async function promptForOrganizationId() {
	organizationId = await promptQuestion('Enter organization Id: ')
}

async function readAndUpdateEntityType() {
	try {
		// Reading EntityType
		const response = await axios.post(
			`${MENTORING_DOMAIN}/mentoring/v1/entity-type/read`,
			JSON.stringify({ value: ['status', 'medium'] }),
			{
				headers: {
					'x-auth-token': `bearer ${accessToken}`,
					'Content-Type': 'application/json',
					'admin-auth-token': `${adminAuthToken}`,
					'organization-id': `${organizationId}`,
				},
			}
		)

		const getEntitiesByType = (typeValue) => {
			const entityType = response.data.result.entity_types.find((e) => e.value === typeValue)
			return entityType ? entityType.id : []
		}

		const statusEntities = await getEntitiesByType('status')
		const mediumEntities = await getEntitiesByType('medium')

		// Status Update EntityType
		const statusEntityUpdate = await axios.post(
			`${MENTORING_DOMAIN}/mentoring/v1/entity-type/update/${statusEntities}`,
			JSON.stringify({ allow_filtering: false, model_names: ['Session'] }),
			{
				headers: {
					'x-auth-token': `bearer ${accessToken}`,
					'Content-Type': 'application/json',
					'admin-auth-token': `${adminAuthToken}`,
					'organization-id': `${organizationId}`,
				},
			}
		)

		// Medium Update EntityType
		const mediumEntityUpdate = await axios.post(
			`${MENTORING_DOMAIN}/mentoring/v1/entity-type/update/${mediumEntities}`,
			JSON.stringify({ required: true, model_names: ['Session'] }),
			{
				headers: {
					'x-auth-token': `bearer ${accessToken}`,
					'Content-Type': 'application/json',
					'admin-auth-token': `${adminAuthToken}`,
					'organization-id': `${organizationId}`,
				},
			}
		)

		console.log('Status', statusEntityUpdate.data.message)
		console.log('Medium', mediumEntityUpdate.data.message)
	} catch (error) {
		console.error('Entity type creation failed:', error)
		throw error
	}
}

function promptQuestion(question, hidden = false) {
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			resolve(answer.trim())
		})

		if (hidden) {
			rl.output.write('\x1B[?25l')
		}
	})
}

main()
