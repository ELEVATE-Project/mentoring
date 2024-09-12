const readline = require('readline')
const fs = require('fs')
const axios = require('axios')

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

let accessToken = ''
let entityTypeId = ''
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

		while (true) {
			const chosenFile = await selectCsvFile()
			if (!chosenFile) break

			const required = await promptForRequired()
			const modelNames = await promptForModelNames()
			const entityTypeData = buildEntityTypeData(chosenFile, modelNames, required)
			await createEntityType(entityTypeData)

			await processCsvFile(chosenFile)

			console.log('\n----------------------------------------\n')
			console.log('Choose another CSV file or type "exit" to quit.')
			console.log('\n----------------------------------------\n')
		}
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

async function promptForRequired() {
	const requiredAnswer = await promptQuestion('Is EntityType Mandatory ? (y/n, default is y): ')
	const requiredValue = requiredAnswer.toLowerCase() === 'n' ? false : true
	return requiredValue
}

function selectCsvFile() {
	return new Promise((resolve, reject) => {
		fs.readdir(__dirname, (err, files) => {
			if (err) {
				console.error('Error reading directory:', err)
				reject(err)
				return
			}

			const csvFiles = files.filter((file) => file.endsWith('.csv'))
			console.log('CSV files available:')
			csvFiles.forEach((file, index) => {
				console.log(`${index + 1}. ${file}`)
			})
			console.log('0. Exit')

			rl.question('Choose a CSV file (enter number or "exit"): ', (answer) => {
				if (answer.toLowerCase() === 'exit' || answer === '0') {
					resolve(null)
					return
				}

				const fileIndex = parseInt(answer) - 1
				if (fileIndex >= 0 && fileIndex < csvFiles.length) {
					const chosenFile = csvFiles[fileIndex]
					console.log(`Chosen CSV file: ${chosenFile}`)
					resolve(chosenFile)
				} else {
					reject(new Error('Invalid choice.'))
				}
			})
		})
	})
}

function promptForModelNames() {
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

async function createEntityType(entityTypeData) {
	try {
		const response = await axios.post(
			`${MENTORING_DOMAIN}/mentoring/v1/entity-type/create`,
			JSON.stringify(entityTypeData),
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
		entityTypeId = response.data.result.id
		console.log('Entity type created successfully. Entity type ID:', entityTypeId)
	} catch (error) {
		console.error('Entity type creation failed:', error)
		throw error
	}
}

async function processCsvFile(chosenFile) {
	try {
		const csvData = fs.readFileSync(`${__dirname}/${chosenFile}`, 'utf8')
		const lines = csvData.trim().split('\n')
		const headers = lines[0].trim().split(',')
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].split(',')
			const identifier = line[headers.indexOf('identifier')]
			const entity = line[headers.indexOf('entity')]

			await createEntity(identifier, entity)
		}

		console.log('All entities created successfully.')
	} catch (error) {
		console.error('Error processing CSV file:', error)
	}
}

async function createEntity(identifier, entity, retries = 3) {
	try {
		const response = await axios.post(
			`${MENTORING_DOMAIN}/mentoring/v1/entity/create`,
			JSON.stringify({
				value: identifier.trim(),
				label: entity.trim(),
				status: 'ACTIVE',
				type: 'SYSTEM',
				entity_type_id: entityTypeId,
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
		console.log(`Entity created successfully: ${identifier} - ${entity}`)
	} catch (error) {
		if (error.response) {
			console.error(`Failed to create entity (${identifier} - ${entity}):`, error.response.data)
		} else {
			console.error(`Failed to create entity (${identifier} - ${entity}):`, error.message)
		}

		if (retries > 0) {
			console.log(`Retrying (${retries} retries left)...`)
			await createEntity(identifier, entity, retries - 1)
		} else {
			console.log(`Max retries reached for (${identifier} - ${entity}). Skipping.`)
		}
	}
}

function buildEntityTypeData(chosenFile, modelNames, required) {
	return {
		value: chosenFile.replace('.csv', '').toLowerCase(),
		label: chosenFile
			.replace('.csv', '')
			.replace(/_/g, ' ')
			.toLowerCase()
			.replace(/\b\w/g, (l) => l.toUpperCase()),
		status: 'ACTIVE',
		allow_filtering: false,
		data_type: 'STRING',
		allow_custom_entities: true,
		model_names: modelNames,
		required: required,
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
