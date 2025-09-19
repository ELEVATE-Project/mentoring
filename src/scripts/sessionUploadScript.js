require('module-alias/register')
const fs = require('fs')
require('dotenv').config({ path: '../.env' })
const path = require('path')
const fileService = require('@services/files')
const request = require('request')
const common = require('@constants/common')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const { getDefaults } = require('@helpers/getDefaultOrgId')

;(async () => {
	try {
		const fileName = 'BulkSessionCreationNew.csv'
		const filePath = path.join(__dirname, '../assets', fileName)

		//check file exist
		fs.access(filePath, fs.constants.F_OK, (err) => {
			if (err) {
				console.error('The file does not exist in the folder.')
			} else {
				console.log('The file exists in the folder.')
			}
		})

		const uploadFilePath = process.env.SAMPLE_CSV_FILE_PATH
		const uploadFolder = path.dirname(uploadFilePath)
		const uploadFileName = path.basename(uploadFilePath)

		//get signed url
		const getSignedUrl = await fileService.getSignedUrl(uploadFileName, '', uploadFolder, false)

		if (!getSignedUrl.result) {
			throw new Error('FAILED_TO_GENERATE_SIGNED_URL')
		}

		const fileUploadUrl = getSignedUrl.result.signedUrl

		const fileData = fs.readFileSync(filePath, 'utf-8')

		//upload file
		await request({
			url: fileUploadUrl,
			method: 'put',
			headers: {
				'x-ms-blob-type': common.azureBlobType,
				'Content-Type': 'multipart/form-data',
			},
			body: fileData,
		})
		const defaults = await getDefaults()
		if (!defaults.orgCode)
			return responses.failureResponse({
				message: 'DEFAULT_ORG_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		if (!defaults.tenantCode)
			return responses.failureResponse({
				message: 'DEFAULT_TENANT_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})

		const data = { uploads: { session_csv_path: getSignedUrl.result.destFilePath } }
		const upadteCsvInOrgExtention = await organisationExtensionQueries.update(
			data,
			defaults.orgCode,
			defaults.tenantCode
		)
		if (upadteCsvInOrgExtention === 0) {
			console.log('updating csv_path for default org_id failed')
		} else {
			console.log('updating csv_path for default org_id completed')
		}
		console.log('file path: ' + getSignedUrl.result.destFilePath)
		console.log('completed')
	} catch (error) {
		console.log(error)
	}
})().catch((err) => console.error(err))
