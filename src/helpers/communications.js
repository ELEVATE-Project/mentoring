'use strict'
const communicationRequests = require('@requests/communications')
const userExtensionQueries = require('@database/queries/userExtension')
const emailEncryption = require('@utils/emailEncryption')
const common = require('@constants/common')
const utils = require('@generics/utils')
const userRequests = require('@requests/user')

/**
 * Logs in a user and retrieves authentication token and user ID.
 * @async
 * @param {string} userId - Unique identifier of the user.
 * @returns {Promise<Object>} An object containing auth_token and user_id if login is successful.
 * @throws Will throw an error if the login request fails for reasons other than unauthorized access.
 */
exports.login = async (userId) => {
	try {
		const login = await communicationRequests.login({ userId })
		return {
			auth_token: login.result.auth_token,
			user_id: login.result.user_id,
		}
	} catch (error) {
		if (error.message === common.COMMUNICATION.UNAUTHORIZED) {
			console.error('Error: Unauthorized access during login. Please check your tokens.')
		}
		throw error
	}
}

/**
 * Logs out a user from the communication service.
 * @async
 * @param {string} userId - Unique identifier of the user.
 * @returns {Promise<Object>} The status of the logout operation.
 * @throws Will throw an error if the logout request fails for reasons other than unauthorized access.
 */
exports.logout = async (userId) => {
	try {
		const logout = await communicationRequests.logout({ userId })
		return logout.result.status
	} catch (error) {
		if (error.message === common.COMMUNICATION.UNAUTHORIZED) {
			console.error('Error: Unauthorized access during logout. Please check your tokens.')
		}
		throw error
	}
}

/**
 * Updates a user's avatar.
 * @async
 * @param {string} userId - Unique identifier of the user.
 * @param {string} imageUrl - New avatar URL for the user.
 * @returns {Promise<void>} Resolves if the update is successful.
 * @throws Will throw an error if the updateAvatar request fails.
 */
exports.updateAvatar = async (userId, imageUrl) => {
	try {
		await communicationRequests.updateAvatar(userId, imageUrl)
	} catch (error) {
		console.error(`Error updating avatar for user ${userId}:`, error.message)
		throw error
	}
}

/**
 * Updates a user's name.
 * @async
 * @param {string} userId - Unique identifier of the user.
 * @param {string} name - New name for the user.
 * @returns {Promise<void>} Resolves if the update is successful.
 * @throws Will throw an error if the updateUser request fails.
 */
exports.updateUser = async (userId, name) => {
	try {
		await communicationRequests.updateUser(userId, name)
	} catch (error) {
		console.error(`Error updating user ${userId}:`, error.message)
		throw error
	}
}

/**
 * Creates or updates a user in the communication service.
 * Optimized to handle updates for avatar and name if the user already exists.
 * @async
 * @param {Object} userData - Data for the user.
 * @param {string} userData.userId - Unique identifier of the user.
 * @param {string} userData.name - Name of the user.
 * @param {string} userData.email - Email of the user.
 * @param {string} userData.image - URL of the user's profile image.
 * @returns {Promise<void>} Resolves if creation or updates are successful.
 * @throws Will throw an error if any request fails.
 */
exports.createOrUpdateUser = async ({ userId, name, email, image }) => {
	try {
		const user = await userExtensionQueries.getUserById(userId, {
			attributes: ['meta'],
		})

		if (user && user.meta?.communications_user_id) {
			// Update user information if already exists in the communication service
			await Promise.all([
				image ? this.updateAvatar(userId, image) : Promise.resolve(),
				name ? this.updateUser(userId, name) : Promise.resolve(),
			])
		} else {
			// Create new user in the communication service
			await this.create(userId, name, email, image)
		}
	} catch (error) {
		console.error('Error in createOrUpdateUser:', error.message)
		throw error
	}
}

/**
 * Creates a new user in the communication system, then updates the user's metadata.
 * @async
 * @param {string} userId - Unique identifier of the user.
 * @param {string} name - Name of the user.
 * @param {string} email - Email of the user.
 * @param {string} image - URL of the user's profile image.
 * @returns {Promise<Object>} An object containing the user_id from the communication service.
 * @throws Will throw an error if the signup request fails for reasons other than unauthorized access.
 */
exports.create = async (userId, name, email, image) => {
	try {
		const signup = await communicationRequests.signup({ userId, name, email, image })

		if (signup.result.user_id) {
			// Update the user's metadata with the communication service user ID
			await userExtensionQueries.updateMenteeExtension(
				userId,
				{ meta: { communications_user_id: signup.result.user_id } },
				{
					returning: true,
					raw: true,
				}
			)
		}
		return {
			user_id: signup.result.user_id,
		}
	} catch (error) {
		if (error.message === common.COMMUNICATION.UNAUTHORIZED) {
			console.error('Error: Unauthorized access during signup. Please check your tokens.')
		}
		throw error
	}
}

/**
 * Creates a chat room between two users. If a user lacks a communications ID, it creates one.
 * @async
 * @param {string} recipientUserId - The ID of the user to receive the chat room invite.
 * @param {string} initiatorUserId - The ID of the user initiating the chat room.
 * @param {string} initialMessage - An initial message to be sent in the chat room.
 * @returns {Promise<Object>} The response from the communication service upon creating the chat room.
 * @throws Will throw an error if the request to create a chat room fails.
 */
exports.createChatRoom = async (recipientUserId, initiatorUserId, initialMessage) => {
	try {
		// Retrieve user details, ensuring each has a `communications_user_id`
		let userDetails = await userExtensionQueries.getUsersByUserIds(
			[initiatorUserId, recipientUserId],
			{
				attributes: ['name', 'user_id', 'email', 'meta', 'image'],
			},
			true
		)

		// Loop through users to ensure they have a `communications_user_id`
		for (const user of userDetails) {
			if (!user.meta || !user.meta.communications_user_id) {
				// Decrypt email and create user in communication service if `communications_user_id` is missing
				user.email = await emailEncryption.decrypt(user.email)
				let userImage
				if (user?.image) {
					userImage = (await userRequests.getDownloadableUrl(user.image))?.result
				}
				await this.create(user.user_id, user.name, user.email, userImage)
			}
		}

		// Create the chat room after ensuring all users have `communications_user_id`
		const chatRoom = await communicationRequests.createChatRoom({
			userIds: [initiatorUserId, recipientUserId],
			initialMessage: initialMessage,
		})
		return chatRoom
	} catch (error) {
		console.error('Create Room Failed:', error)
		throw error
	}
}
