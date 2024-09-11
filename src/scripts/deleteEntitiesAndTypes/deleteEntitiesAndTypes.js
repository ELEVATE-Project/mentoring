const readline = require('readline')
const fs = require('fs')
const axios = require('axios')

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

let authenticatedUserToken = ''
let adminAuthToken = ''
let organizationId = ''
let authorization = ''

const DEFAULT_MENTORING_DOMAIN = 'http://localhost:3569'
let MENTORING_DOMAIN = DEFAULT_MENTORING_DOMAIN

async function main() {
	try {
		await promptForDomain()
		await promptForAuthenticatedUserToken()
		await promptForAuthorization()
		await promptForAdminAuthToken()
		await promptForOrganizationId()
		const entityTypes = await promptForEntityTypeValues()
		return await deleteEntityType(entityTypes)
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

async function promptForEntityTypeValues() {
	return new Promise((resolve, reject) => {
		rl.question('Enter entity type values(space separated): ', (answer) => {
			const entityTypeValues = answer.split(' ').filter((name) => name.length > 0)
			if (entityTypeValues.length > 0) {
				console.log('Chosen entity type values :', entityTypeValues)
				resolve(entityTypeValues)
			} else {
				reject(new Error('No entity type values provided.'))
			}
		})
	})
}

async function deleteEntityType(entityTypes) {
	try {
		const response = await axios.delete(`${MENTORING_DOMAIN}/mentoring/v1/entity-type/delete`, {
			headers: {
				'x-authenticated-user-token': `${authenticatedUserToken}`,
				Authorization: `bearer ${authorization}`,
				'Content-Type': 'application/json',
				'admin-auth-token': `${adminAuthToken}`,
				'organization-id': `${organizationId}`,
			},
			data: JSON.stringify({ value: entityTypes }),
		})

		console.log(response.data.message)
	} catch (error) {
		console.error('Entity type deletion failed:', error)
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
