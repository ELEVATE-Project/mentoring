const readline = require('readline')
const fs = require('fs')
const axios = require('axios')

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

let adminAuthToken = ''
let organizationId = ''
let allowFilteringAnswer = ''
let requiredAnswer = ''
let entityTypeValue = ''
let authenticatedUserToken = ''

const DEFAULT_MENTORING_DOMAIN = 'http://localhost:3567'
let MENTORING_DOMAIN = DEFAULT_MENTORING_DOMAIN

async function main() {
	try {
		await promptForDomain()
		await promptForAuthenticatedUserToken()
		await promptForAuthorization()
		await promptForAdminAuthToken()
		await promptForOrganizationId()

		const EntityTypeValues = await promptForEntityTypes()
		const mandatoryRequired = await promptForRequired()
		const modelValues = await promptForModelNames()
		const allowFilterValue = await promptForAllowFiltering()

		return await readAndUpdateEntityType(EntityTypeValues, allowFilterValue, modelValues, mandatoryRequired)
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

async function promptForAuthenticatedUserToken() {
	authenticatedUserToken = await promptQuestion('Enter authenticated user token: ')
}

async function promptForAuthorization() {
	authorization = await promptQuestion('Enter authorization token: ')
}

async function promptForAdminAuthToken() {
	adminAuthToken = await promptQuestion('Enter admin Auth Token: ')
}

async function promptForOrganizationId() {
	organizationId = await promptQuestion('Enter organization Id: ')
}

async function promptForAllowFiltering() {
	allowFilteringAnswer = await promptQuestion('Allow filtering? (y/n, default is n): ')
	const allowfilteringEntitytype = allowFilteringAnswer.toLowerCase() === 'y' ? true : false
	return allowfilteringEntitytype
}

async function promptForEntityTypes() {
	entityTypeValue = await promptQuestion('Enter entity type value: ')
	return [entityTypeValue]
}

async function promptForModelNames() {
	return new Promise((resolve, reject) => {
		rl.question('Enter model names (space separated): ', (answer) => {
			const modelNames = answer.split(' ').filter((name) => name.length > 0)
			if (modelNames.length > 0) {
				console.log('Chosen model names:', modelNames)
				resolve(modelNames)
			} else {
				reject(new Error('No model names provided.'))
			}
		})
	})
}

async function promptForRequired() {
	requiredAnswer = await promptQuestion('Madatory entityType ? (y/n, default is n): ')
	const requiredEntitytype = requiredAnswer.toLowerCase() === 'y' ? true : false
	return requiredEntitytype
}

async function readAndUpdateEntityType(readEntityType, allowFilterValue, modelValues, mandatoryRequired) {
	try {
		// Reading EntityType
		const response = await axios.post(
			`${MENTORING_DOMAIN}/mentoring/v1/entity-type/read`,
			JSON.stringify({ value: readEntityType }),
			{
				headers: {
					'x-authenticated-user-token': `${authenticatedUserToken}`,
					Authorization: `bearer ${authorization}`,
					'Content-Type': 'application/json',
					'admin-auth-token': `${adminAuthToken}`,
					'organization-id': `${organizationId}`,
				},
			}
		)

		const entityTypeResult = response.data.result.entity_types
		const getEntitiesByType = (typeValue) => {
			const entityType = entityTypeResult.find((e) => e.value === typeValue)
			return entityType ? entityType.id : []
		}

		for (let i = 0; i < entityTypeResult.length; i++) {
			const entitytypebyvalue = await getEntitiesByType(entityTypeResult[i].value)

			const EntityUpdate = await axios.post(
				`${MENTORING_DOMAIN}/mentoring/v1/entity-type/update/${entitytypebyvalue}`,
				JSON.stringify({
					allow_filtering: allowFilterValue,
					model_names: modelValues,
					required: mandatoryRequired,
				}),
				{
					headers: {
						'x-authenticated-user-token': `${authenticatedUserToken}`,
						Authorization: `bearer ${authorization}`,
						'Content-Type': 'application/json',
						'admin-auth-token': `${adminAuthToken}`,
						'organization-id': `${organizationId}`,
					},
				}
			)

			console.log(entityTypeResult[i].value, EntityUpdate.data.message)
		}
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
