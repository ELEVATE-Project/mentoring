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
let searchValue = ''
let replaceValue = ''
let updateOption = ''

const DEFAULT_MENTORING_DOMAIN = 'http://localhost:3567'
let MENTORING_DOMAIN = DEFAULT_MENTORING_DOMAIN

async function main() {
	try {
		await promptForDomain()
		await promptForAuthenticatedUserToken()
		await promptForAuthorization()
		await promptForAdminAuthToken()
		await promptForOrganizationId()
		await promptForUpdateOptions()

		if (updateOption == 2) {
			const allTemplates = await readAllTemplates()
			await promptForSearch()
			await promptForReplace()
			const updatedTemplates = await searchAndReplaceInTemplates(allTemplates, searchValue, replaceValue)
			for (let i = 1; i < updatedTemplates.length; i++) {
				const id = updatedTemplates[i].id
				const updateBody = await buildNotificationUpdateData(updatedTemplates[i])
				await updateTemplate(updateBody, id)
			}
		} else {
			const chosenFile = await selectJsonFile()
			await processJsonFile(chosenFile)
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

async function promptForUpdateOptions() {
	const question = `
Type of Update:
1. One template
2. All templates

Please enter number(Ex : 1, default choice is 1 ): `
	updateOption = await promptQuestion(question)
}

function selectJsonFile() {
	return new Promise((resolve, reject) => {
		// Read the current directory
		fs.readdir(__dirname, (err, files) => {
			if (err) {
				console.error('Error reading directory:', err)
				reject(err)
				return
			}

			// Filter out only JSON files
			const jsonFiles = files.filter((file) => file.endsWith('.json'))

			if (jsonFiles.length === 0) {
				console.log('No JSON files available.')
				resolve(null)
				return
			}

			// Display available JSON files to the user
			console.log('JSON files available:')
			jsonFiles.forEach((file, index) => {
				console.log(`${index + 1}. ${file}`)
			})
			console.log('0. Exit')

			// Prompt user to select a file
			rl.question('Choose a JSON file (enter number or "exit"): ', (answer) => {
				if (answer.toLowerCase() === 'exit' || answer === '0') {
					resolve(null)
					return
				}

				const fileIndex = parseInt(answer) - 1

				// Validate the user's choice
				if (fileIndex >= 0 && fileIndex < jsonFiles.length) {
					const chosenFile = jsonFiles[fileIndex]
					console.log(`Chosen JSON file: ${chosenFile}`)
					resolve(chosenFile)
				} else {
					reject(new Error('Invalid choice.'))
				}
			})
		})
	})
}

async function processJsonFile(chosenFile) {
	try {
		// Read and parse the JSON file
		const jsonData = JSON.parse(fs.readFileSync(`${__dirname}/${chosenFile}`, 'utf8'))

		// Iterate through each object in the JSON array
		for (let i = 0; i < jsonData.length; i++) {
			const entry = jsonData[i]
			const code = entry.code
			const newbody = entry.body

			// Read template data using the code
			const readTemplateData = await readTemplate(code)

			// Build the updated template data
			const updateBodyData = await buildNotificationTemplateData(readTemplateData, newbody)

			// Get the ID of the template to update
			const id = readTemplateData.id

			// Update the template using the new body
			await updateTemplate(updateBodyData, id)
		}

		console.log('All templates processed successfully.')
	} catch (error) {
		console.error('Error processing JSON file:', error)
	}
}

async function promptForSearch() {
	searchValue = await promptQuestion('Enter the search words : ')
}

async function promptForReplace() {
	replaceValue = await promptQuestion('Enter the replace words : ')
}

async function searchAndReplaceInTemplates(templates, searchValue, replaceValue) {
	if (templates.length > 0) {
		templates.forEach((template) => {
			// Apply search and replace to the subject and body fields
			if (template.subject && template.subject.includes(searchValue)) {
				template.subject = template.subject.replace(new RegExp(searchValue, 'g'), replaceValue)
			}

			if (template.body && template.body.includes(searchValue)) {
				template.body = template.body.replace(new RegExp(searchValue, 'g'), replaceValue)
			}
		})
		return templates // Return the modified templates
	} else {
		return console.log('search value not found')
	}
}

async function buildNotificationTemplateData(readTemplateData, newbody) {
	return {
		type: readTemplateData.type,
		code: readTemplateData.code,
		subject: readTemplateData.subject,
		body: newbody,
	}
}

async function buildNotificationUpdateData(updateDataBody) {
	return {
		type: updateDataBody.type,
		code: updateDataBody.code,
		subject: updateDataBody.subject,
		body: updateDataBody.body,
	}
}

async function readAllTemplates() {
	try {
		const readAllTemplates = await axios.get(`${MENTORING_DOMAIN}/mentoring/v1/notification/template`, {
			headers: {
				'x-authenticated-user-token': `${authenticatedUserToken}`,
				Authorization: `bearer ${authorization}`,
				'Content-Type': 'application/json',
				'admin-auth-token': `${adminAuthToken}`,
				'organization-id': `${organizationId}`,
			},
		})
		console.log(readAllTemplates.data.message)
		return readAllTemplates.data.result
	} catch (error) {
		console.error('Entity type deletion failed:', error)
		throw error
	}
}

async function readTemplate(code) {
	try {
		const readTemplate = await axios.get(`${MENTORING_DOMAIN}/mentoring/v1/notification/template`, {
			headers: {
				'x-authenticated-user-token': `${authenticatedUserToken}`,
				Authorization: `bearer ${authorization}`,
				'Content-Type': 'application/json',
				'admin-auth-token': `${adminAuthToken}`,
				'organization-id': `${organizationId}`,
			},
			params: { code: code },
		})
		console.log(readTemplate.data.message)
		return readTemplate.data.result[0]
	} catch (error) {
		console.error('Entity type deletion failed:', error)
		throw error
	}
}

async function updateTemplate(updateBodyData, id) {
	try {
		const updateTemplate = await axios.patch(
			`${MENTORING_DOMAIN}/mentoring/v1/notification/template/${id}`,
			updateBodyData,
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
		console.log(updateTemplate.data.message)
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
