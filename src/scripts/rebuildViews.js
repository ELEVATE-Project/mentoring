const readline = require('readline')
const fs = require('fs')
const axios = require('axios')

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

let adminAuthToken = ''
let organizationId = ''

const DEFAULT_MENTORING_DOMAIN = 'http://localhost:3569'
let MENTORING_DOMAIN = DEFAULT_MENTORING_DOMAIN

async function main() {
	try {
		await promptForDomain()
		await promptForAuthenticatedUserToken()
		await promptForAuthorization()
		await promptForAdminAuthToken()
		await promptForOrganizationId()
		return await triggerViewRebuild()
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

async function promptForAuthorization() {
	authorization = await promptQuestion('Enter authorization token: ')
}

async function promptForAdminAuthToken() {
	adminAuthToken = await promptQuestion('Enter admin Auth Token: ')
}

async function promptForAdminAuthToken() {
	adminAuthToken = await promptQuestion('Enter admin Auth Token: ')
}

async function promptForOrganizationId() {
	organizationId = await promptQuestion('Enter organization Id: ')
}

async function triggerViewRebuild() {
	try {
		const response = await axios.get(`${MENTORING_DOMAIN}/mentoring/v1/admin/triggerViewRebuild`, {
			headers: {
				'x-authenticated-user-token': `${authenticatedUserToken}`,
				Authorization: `bearer ${authorization}`,
				'Content-Type': 'application/json',
				'admin-auth-token': `${adminAuthToken}`,
				'organization-id': `${organizationId}`,
			},
		})

		console.log(response.data.message)
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
