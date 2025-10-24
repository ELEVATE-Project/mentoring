const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const defaultSearchConfig = require('@configs/search.json')
const { convertKeysToSnakeCase } = require('@generics/utils')
const searchConfig = require('@root/config.json')
const cacheHelper = require('@generics/cacheHelper')

module.exports = class platformHelper {
	/**
	 * Get application configuration.
	 *
	 * @static
	 * @async
	 * @method
	 * @name getConfig
	 * @param {string} tenantCode - Tenant code for cache isolation
	 * @returns {Promise<Object>} - A promise that resolves with the application configuration.
	 * @throws {Error} - Throws an error if there's an issue during configuration retrieval.
	 */
	static async getConfig(tenantCode) {
		try {
			return await cacheHelper.getOrSet({
				key: 'global',
				tenantCode,
				ns: 'app_config',
				ttl: 0, // no expiry
				fetchFn: async () => {
					let search_config = defaultSearchConfig
					if (searchConfig.search) {
						search_config = { search: searchConfig.search }
					}

					let config = {
						meeting_platform: process.env.DEFAULT_MEETING_SERVICE,
						session_mentee_limit: process.env.SESSION_MENTEE_LIMIT,
						search_config: convertKeysToSnakeCase(search_config),
						chat_config: process.env.ENABLE_CHAT,
					}

					return responses.successResponse({
						statusCode: httpStatusCode.created,
						message: 'APP_CONFIG_FETCHED_SUCCESSFULLY',
						result: config,
					})
				},
			})
		} catch (error) {
			console.error(error)
			throw error
		}
	}
}
