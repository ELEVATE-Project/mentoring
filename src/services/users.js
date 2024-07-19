// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const userRequests = require('@requests/user')
const menteeQueries = require('@database/queries/userExtension')
const mentorQueries = require('@database/queries/mentorExtension')
const responses = require('@helpers/responses')

const IdMappingQueries = require('@database/queries/idMapping')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const mentorsService = require('@services/mentors')
const menteesService = require('@services/mentees')
const orgAdminService = require('@services/org-admin')

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

	static async list(userType, pageNo, pageSize, searchText) {
		try {
			const userDetails = await userRequests.list(userType, pageNo, pageSize, searchText)
			const ids = userDetails.data.result.data.map((item) => item.values[0].id)

			let extensionDetails
			if (userType == common.MENTEE_ROLE) {
				extensionDetails = await menteeQueries.getUsersByUserIds(ids, {
					attributes: ['user_id', 'rating'],
				})
			} else if (userType == common.MENTOR_ROLE) {
				extensionDetails = await mentorQueries.getMentorsByUserIds(ids, {
					attributes: ['user_id', 'rating', 'mentor_visibility', 'organization_id'],
				})
				// Inside your function
				extensionDetails = extensionDetails.filter((item) => item.mentor_visibility && item.organization_id)
			}
			const extensionDataMap = new Map(extensionDetails.map((newItem) => [newItem.user_id, newItem]))

			userDetails.data.result.data = userDetails.data.result.data.filter((existingItem) => {
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
				message: userDetails.data.message,
				result: userDetails.data.result,
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	static async create(decodedToken) {
		try {
			let isNew = false
			if (!decodedToken.id) {
				const [idMapping] = await IdMappingQueries.findOrCreate({ uuid: decodedToken.externalId })
				decodedToken.id = idMapping.id
				isNew = true
			}
			const result = await this.#createOrUpdateUserAndOrg(decodedToken.id, isNew)
			return result
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	static async update(updateData) {
		try {
			const userId = updateData.userId
			const [idMapping, isNew] = await IdMappingQueries.findOrCreate({ uuid: userId })
			const result = await this.#createOrUpdateUserAndOrg(idMapping.id, isNew, updateData)
			return result
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	static async #createOrUpdateUserAndOrg(userId, isNew, updateData = null) {
		const userDetails = await userRequests.fetchUserDetails({ userId })
		if (!userDetails?.data?.result) {
			return responses.failureResponse({
				message: 'SOMETHING_WENT_WRONG',
				statusCode: httpStatusCode.not_found,
				responseCode: 'UNAUTHORIZED',
			})
		}
		const orgExtension = await this.#createOrUpdateOrg({ uuid: userDetails.data.result.organization_id })
		const userExtensionData = this.#getExtensionData(userDetails.data.result, orgExtension)
		const result = isNew ? await this.#createUser(userExtensionData) : await this.#updateUser(userExtensionData)

		return responses.successResponse({
			statusCode: httpStatusCode.ok,
			message: 'PROFILE_CREATED_SUCCESSFULLY',
			result: result,
		})
	}

	static #getExtensionData(userDetails, orgExtension) {
		return {
			uuid: userDetails.uuid,
			id: userDetails.id,
			organization: {
				uuid: userDetails.organization_id,
				id: orgExtension.organization_id,
			},
			roles: userDetails.user_roles,
			email: userDetails.email,
			phone: userDetails.phone,
			name: userDetails.name,
		}
	}

	static async #createOrUpdateOrg(orgData) {
		const [idMapping, isNew] = await IdMappingQueries.findOrCreate({
			uuid: orgData.uuid,
		})
		if (isNew) {
			const orgExtensionData = {
				...common.DEFAULT_ORGANISATION_POLICY,
				organization_id: idMapping.id,
				created_by: 1,
				updated_by: 1,
			}
			const orgExtension = await organisationExtensionQueries.upsert(orgExtensionData)
			return orgExtension.toJSON()
		} else {
			return await organisationExtensionQueries.getById(idMapping.id)
		}
	}

	static async #createUser(userExtensionData) {
		const isAMentor = userExtensionData.roles.some((role) => role.title == common.MENTOR_ROLE)
		const [idMapping] = await IdMappingQueries.findOrCreate({
			uuid: userExtensionData.uuid,
		})
		userExtensionData.id = idMapping.id
		const orgId = userExtensionData.organization.id
		const user = isAMentor
			? await mentorsService.createMentorExtension(userExtensionData, idMapping.id, orgId)
			: await menteesService.createMenteeExtension(userExtensionData, idMapping.id, orgId)
		return user.result
	}

	static #checkOrgChange = (existingOrgId, newOrgId) => existingOrgId !== newOrgId

	static async #updateUser(userExtensionData) {
		const isAMentee = userExtensionData.roles.some((role) => role.title === common.MENTEE_ROLE)
		const roleChangePayload = {
			user_id: userExtensionData.id,
			organization_id: userExtensionData.organization.id,
		}

		let isRoleChanged = false

		if (isAMentee) {
			const menteeExtension = await menteeQueries.getMenteeExtension(userExtensionData.id, ['organization_id'])

			if (!menteeExtension) {
				const mentorExtension = await mentorQueries.getMentorExtension(userExtensionData.id, [
					'organization_id',
				])
				if (!mentorExtension) throw new Error('User Not Found')

				roleChangePayload.current_roles = [common.MENTOR_ROLE]
				roleChangePayload.new_roles = [common.MENTEE_ROLE]
				isRoleChanged = true
			}
		} else {
			const mentorExtension = await mentorQueries.getMentorExtension(userExtensionData.id, ['organization_id'])
			if (!mentorExtension) {
				const menteeExtension = await menteeQueries.getMenteeExtension(userExtensionData.id, [
					'organization_id',
				])
				if (!menteeExtension) throw new Error('User Not Found')

				roleChangePayload.current_roles = [common.MENTEE_ROLE]
				roleChangePayload.new_roles = [common.MENTOR_ROLE]
				isRoleChanged = true
			}
		}
		if (isRoleChanged) {
			//If role is changed, the role change, org policy changes for that user
			//and additional data update of the user is done by orgAdmin's roleChange workflow
			const roleChangeResult = await orgAdminService.roleChange(roleChangePayload, userExtensionData)
			return roleChangeResult.result
		} else {
			//If role is not changed, org policy changes along with other user data updation is done
			//using the updateMentee or updateMentor workflows
			const user = isAMentee
				? await menteesService.updateMenteeExtension(
						userExtensionData,
						userExtensionData.id,
						userExtensionData.organization.id
				  )
				: await mentorsService.updateMentorExtension(
						userExtensionData,
						userExtensionData.id,
						userExtensionData.organization.id
				  )
			return user.result
		}
	}
}
