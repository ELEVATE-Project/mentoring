const cloudServices = require('@generics/cloud-services')
const httpStatusCode = require('@generics/http-status')
const cloudUtils = require('@utils/cloud')
const responses = require('@helpers/responses')

module.exports = class FilesHelper {
	static async getSignedUrl(fileName, id, dynamicPath) {
		try {
			let destFilePath
			if (dynamicPath != '') {
				destFilePath = dynamicPath + '/' + fileName
			} else {
				destFilePath = `session/${id}-${new Date().getTime()}-${fileName}`
			}
			let response
			if (process.env.CLOUD_STORAGE === 'GCP') {
				response = await cloudServices.getGcpSignedUrl(destFilePath)
			} else if (process.env.CLOUD_STORAGE === 'AWS') {
				response = await cloudServices.getAwsSignedUrl(destFilePath)
			} else if (process.env.CLOUD_STORAGE === 'AZURE') {
				response = await cloudServices.getAzureSignedUrl(destFilePath)
			} else if (process.env.CLOUD_STORAGE === 'OCI') {
				response = await cloudServices.getOciSignedUrl(destFilePath)
			}

			response.destFilePath = destFilePath

			return responses.successResponse({
				message: 'SIGNED_URL_GENERATED_SUCCESSFULLY',
				statusCode: httpStatusCode.ok,
				responseCode: 'OK',
				result: response,
			})
		} catch (error) {
			throw error
		}
	}

	static async getDownloadableUrl(path) {
		try {
			let response = await cloudUtils.getDownloadableUrl(path)
			return responses.successResponse({
				message: 'DOWNLOAD_URL_GENERATED_SUCCESSFULLY',
				statusCode: httpStatusCode.ok,
				responseCode: 'OK',
				result: response,
			})
		} catch (error) {
			throw error
		}
	}
}
