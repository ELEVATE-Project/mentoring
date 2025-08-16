// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const userRequests = require('@requests/user')
const menteeQueries = require('@database/queries/userExtension')
const mentorQueries = require('@database/queries/mentorExtension')
const responses = require('@helpers/responses')

const organisationExtensionQueries = require('@database/queries/organisationExtension')
const mentorsService = require('@services/mentors')
const menteesService = require('@services/mentees')
const orgAdminService = require('@services/org-admin')

const userServiceHelper = require('@helpers/users')

module.exports = class UserHelper {
	/**
	 * Get user list.
	 * @method
	 * @name create
	 * @param {String} userType 				- mentee/mentor.
	 * @param {Number} pageSize 				- Page size.
	 * @param {Number} pageNo 					- Page number.
	 * @param {String} searchText 				- Search text.
	 * @param {Number} searchText 				- userId.
	 * @returns {JSON} 							- User list.
	 */

	static async list(userType, pageNo, pageSize, searchText, userId, organizationId, tenantCode) {
		try {
			const userDetails = await userRequests.list(userType, pageNo, pageSize, searchText, tenantCode)
			const ids = userDetails.result.data.map((item) => item.values[0].id)

			let extensionDetails
			if (userType == common.MENTEE_ROLE) {
				extensionDetails = await menteeQueries.getUsersByUserIds(
					ids,
					{
						attributes: ['user_id', 'rating'],
					},
					tenantCode
				)
			} else if (userType == common.MENTOR_ROLE) {
				extensionDetails = await mentorQueries.getMentorsByUserIds(
					ids,
					{
						attributes: ['user_id', 'rating', 'mentor_visibility', 'organization_id'],
					},
					tenantCode
				)
				// Inside your function
				extensionDetails = extensionDetails.filter((item) => item.mentor_visibility && item.organization_id)
			}
			const extensionDataMap = new Map(extensionDetails.map((newItem) => [newItem.user_id, newItem]))

			userDetails.result.data = userDetails.result.data.filter((existingItem) => {
				const user_id = existingItem.values[0].id
				if (extensionDataMap.has(user_id)) {
					const newItem = extensionDataMap.get(user_id)
					existingItem.values[0] = { ...existingItem.values[0], ...newItem }
					delete existingItem.values[0].user_id
					delete existingItem.values[0].mentor_visibility
					delete existingItem.values[0].organization_id
					return true // Keep this item
				}

				return false // Remove this item
			})

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'USERS_FETCHED_SUCCESSFULLY',
				result: userDetails.result,
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	static async create(decodedToken, userId, organizationId, tenantCode) {
		try {
			const isNewUser = await this.#checkUserExistence(decodedToken.id, decodedToken.tenant_code)
			if (isNewUser) {
				const result = await this.#createOrUpdateUserAndOrg(decodedToken.id, isNewUser, decodedToken)
				return result
			} else {
				const menteeExtension = await menteeQueries.getMenteeExtension(
					decodedToken.id,
					[],
					false,
					decodedToken.tenant_code
				)

				if (!menteeExtension) {
					return responses.failureResponse({
						statusCode: httpStatusCode.not_found,
						message: 'USER_NOT_FOUND',
					})
				}

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'USER_DETAILS_FETCHED_SUCCESSFULLY',
					result: menteeExtension,
				})
			}
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	static async update(updateData, decodedToken, userId, organizationId, tenantCode) {
		try {
			const userId = updateData.userId
			const isNewUser = await this.#checkUserExistence(userId, decodedToken.tenant_code)
			const result = await this.#createOrUpdateUserAndOrg(userId, isNewUser, decodedToken)
			return result
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	static async add(bodyData, userId, organizationId, tenantCode) {
		bodyData.id = bodyData.id.toString()
		let result = {}
		const isNewUser = await this.#checkUserExistence(bodyData.id, tenantCode)
		if (isNewUser) {
			result = await this.#createUserWithBody(bodyData, tenantCode)
		}
		return result
	}

	static async #createUserWithBody(userBody, tenantCode) {
		const orgExtension = await this.#createOrUpdateOrg({ id: userBody.organization_id.toString() }, tenantCode)

		if (!orgExtension) {
			return responses.failureResponse({
				message: 'ORG_EXTENSION_NOT_FOUND',
				statusCode: httpStatusCode.not_found,
				responseCode: 'UNAUTHORIZED',
			})
		}
		const userExtensionData = this.#getExtensionData(userBody, orgExtension)

		const createResult = await this.#createUser({ ...userExtensionData, roles: userBody.roles }, tenantCode)

		if (createResult.statusCode != httpStatusCode.ok) return createResult
		else
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROFILE_CREATED_SUCCESSFULLY',
				result: createResult.result,
			})
	}
	static async #createOrUpdateUserAndOrg(userId, isNewUser, decodedToken) {
		const userDetails = await userRequests.fetchUserDetails({ userId })
		if (!userDetails?.data?.result) {
			return responses.failureResponse({
				message: 'SOMETHING_WENT_WRONG',
				statusCode: httpStatusCode.not_found,
				responseCode: 'UNAUTHORIZED',
			})
		}

		const validationError = await this.#validateUserDetails(userDetails)

		if (validationError) {
			return responses.failureResponse({
				message: validationError,
				statusCode: httpStatusCode.not_found,
				responseCode: 'UNAUTHORIZED',
			})
		}

		const orgExtension = await this.#createOrUpdateOrg(
			{ id: userDetails.data.result.organization_id },
			decodedToken.tenant_code
		)

		if (!orgExtension) {
			return responses.failureResponse({
				message: 'ORG_EXTENSION_NOT_FOUND',
				statusCode: httpStatusCode.not_found,
				responseCode: 'UNAUTHORIZED',
			})
		}
		const userExtensionData = this.#getExtensionData(userDetails.data.result, orgExtension)

		const createOrUpdateResult = isNewUser
			? await this.#createUser(userExtensionData, decodedToken.tenant_code)
			: await this.#updateUser(userExtensionData, decodedToken)
		if (createOrUpdateResult.statusCode != httpStatusCode.ok) return createOrUpdateResult
		else
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROFILE_CREATED_SUCCESSFULLY',
				result: createOrUpdateResult.result,
			})
	}

	static #getExtensionData(userDetails, orgExtension) {
		const data = {
			id: userDetails.id,
			name: userDetails?.name,
			organization: {
				id: orgExtension.organization_id,
			},
		}

		// List of optional fields to check
		const optionalFields = {
			roles: userDetails?.user_roles,
			email: userDetails?.email,
			phone: userDetails?.phone,
			skipValidation: true,
			competency: userDetails?.competency,
			designation: userDetails?.designation,
			language: userDetails?.language,
			image: userDetails?.image ? userDetails.image : '',
		}

		// Add only defined values to the data object
		Object.entries(optionalFields).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				data[key] = value
			}
		})

		return data
	}

	static async #createOrUpdateOrg(orgData, tenantCode) {
		// Use organization_id as organization_code for lookup since they're the same in user service data
		let orgExtension = await organisationExtensionQueries.getById(orgData.id, tenantCode)
		if (orgExtension) return orgExtension

		const orgExtensionData = {
			...common.getDefaultOrgPolicies(),
			organization_id: orgData.id,
			organization_code: orgData.id,
			created_by: 1,
			updated_by: 1,
			tenant_code: tenantCode,
		}
		orgExtension = await organisationExtensionQueries.upsert(orgExtensionData, tenantCode)
		return orgExtension.toJSON()
	}

	static async #createUser(userExtensionData, tenantCode) {
		const isAMentor = userExtensionData.roles.some((role) => role.title == common.MENTOR_ROLE)
		const orgId = userExtensionData.organization.id
		const user = isAMentor
			? await mentorsService.createMentorExtension(userExtensionData, userExtensionData.id, orgId, tenantCode)
			: await menteesService.createMenteeExtension(userExtensionData, userExtensionData.id, orgId, tenantCode)
		return user
	}

	static #checkOrgChange = (existingOrgId, newOrgId) => existingOrgId !== newOrgId

	static async #updateUser(userExtensionData, decodedToken) {
		const isAMentee = userExtensionData.roles.some((role) => role.title === common.MENTEE_ROLE)
		const roleChangePayload = {
			user_id: userExtensionData.id,
			organization_id: userExtensionData.organization.id,
		}

		let isRoleChanged = false

		const menteeExtension = await menteeQueries.getMenteeExtension(
			userExtensionData.id,
			['organization_id', 'is_mentor'],
			false,
			decodedToken.tenant_code
		)

		if (!menteeExtension) throw new Error('User Not Found')

		if (isAMentee && menteeExtension.is_mentor) {
			roleChangePayload.current_roles = [common.MENTOR_ROLE]
			roleChangePayload.new_roles = [common.MENTEE_ROLE]
			isRoleChanged = true
		} else if (!isAMentee && !menteeExtension.is_mentor) {
			roleChangePayload.current_roles = [common.MENTEE_ROLE]
			roleChangePayload.new_roles = [common.MENTOR_ROLE]
			isRoleChanged = true
		}

		if (isRoleChanged) {
			//If role is changed, the role change, org policy changes for that user
			//and additional data update of the user is done by orgAdmin's roleChange workflow
			const roleChangeResult = await orgAdminService.roleChange(
				roleChangePayload,
				userExtensionData,
				decodedToken,
				decodedToken.tenant_code
			)
			return roleChangeResult
		} else {
			if (userExtensionData.email) delete userExtensionData.email
			//If role is not changed, org policy changes along with other user data updation is done
			//using the updateMentee or updateMentor workflows
			const user = isAMentee
				? await menteesService.updateMenteeExtension(
						userExtensionData,
						userExtensionData.id,
						userExtensionData.organization.id,
						decodedToken.tenant_code
				  )
				: await mentorsService.updateMentorExtension(
						userExtensionData,
						userExtensionData.id,
						userExtensionData.organization.id,
						decodedToken.tenant_code
				  )
			return user
		}
	}

	/**
	 * Checks the existence of a user based on their mentee extension.
	 *
	 * @param {string} userId - The ID of the user to check.
	 * @returns {Promise<boolean>} - Returns `true` if the user does not exist, `false` otherwise.
	 * @throws {Error} - Throws an error if the query fails.
	 */
	static async #checkUserExistence(userId, tenantCode) {
		try {
			const menteeExtension = await menteeQueries.getMenteeExtension(
				userId,
				['organization_id'],
				false,
				tenantCode
			)

			// Check if menteeExtension exists
			const userExists = menteeExtension !== null

			return !userExists // Return true if user does not exist
		} catch (error) {
			console.error('HERE: ', error)
			throw error
		}
	}

	/**
	 * Validates that the required user details are present and not null/undefined.
	 *
	 * This function checks if the userDetails object contains the necessary fields
	 * for processing a user. It specifically looks for:
	 * - id
	 * - user_roles
	 * - email
	 * - name
	 * - organization
	 * - organization_id
	 *
	 * If any of these fields are missing or null, the function returns an error message.
	 *
	 * @param {Object} userDetails - The user details object containing user data.
	 * @returns {string|null} - Returns an error message if validation fails, otherwise null.
	 */

	static async #validateUserDetails(userDetails) {
		if (!userDetails.data.result) {
			return 'FAILED_TO_GET_REQUIRED_USER_DETAILS'
		} else {
			const requiredFields = ['id', 'user_roles', 'email', 'name', 'organization', 'organization_id']
			for (const field of requiredFields) {
				if (!userDetails.data.result[field] || userDetails.data.result[field] == null) {
					return 'FAILED_TO_GET_REQUIRED_USER_DETAILS'
				}
			}
		}
		return null
	}

	/**
	 * Get user requestCount.
	 * @method
	 * @name requestCount
	 * @param {String} userId 					- userId	.
	 * @returns {JSON} 							- request count.
	 */

	static async requestCount(userId, tenantCode) {
		try {
			const response = await userServiceHelper.findRequestCounts(userId, tenantCode)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REQUESTS_COUNT_FETCHED',
				result: response,
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}
}
