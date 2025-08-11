'use strict'
const Connection = require('../models/index').Connection
const ConnectionRequest = require('../models/index').ConnectionRequest

const { Op } = require('sequelize')
const sequelize = require('@database/models/index').sequelize

const common = require('@constants/common')
const MenteeExtension = require('@database/models/index').UserExtension
const { QueryTypes } = require('sequelize')

exports.addFriendRequest = async (userId, friendId, message, tenantCode) => {
	try {
		const result = await sequelize.transaction(async (t) => {
			const friendRequestData = [
				{
					user_id: userId,
					friend_id: friendId,
					status: common.CONNECTIONS_STATUS.REQUESTED,
					created_by: userId,
					updated_by: userId,
					tenant_code: tenantCode,
					meta: {
						message,
					},
				},
				{
					user_id: friendId,
					friend_id: userId,
					status: common.CONNECTIONS_STATUS.REQUESTED,
					created_by: userId,
					updated_by: userId,
					tenant_code: tenantCode,
					meta: {
						message,
					},
				},
			]

			const requests = await ConnectionRequest.bulkCreate(friendRequestData, { transaction: t })

			return requests[0].get({ plain: true })
		})

		return result
	} catch (error) {
		throw error
	}
}

exports.getPendingRequests = async (userId, page, pageSize, tenantCode) => {
	try {
		// This will retrieve send and received request

		const result = await ConnectionRequest.findAndCountAll({
			where: {
				user_id: userId,
				status: common.CONNECTIONS_STATUS.REQUESTED,
				tenant_code: tenantCode,
			},
			raw: true,
			limit: pageSize,
			offset: (page - 1) * pageSize,
		})
		return result
	} catch (error) {
		throw error
	}
}

exports.getRejectedRequest = async (userId, friendId, tenantCode) => {
	try {
		const result = await ConnectionRequest.findOne({
			where: {
				user_id: userId,
				friend_id: friendId,
				status: common.CONNECTIONS_STATUS.REJECTED,
				created_by: friendId,
				tenant_code: tenantCode,
			},
			paranoid: false,
			order: [['deleted_at', 'DESC']], // Order by the deleted_at field in descending order to get the latest
			raw: true,
		})
		return result
	} catch (error) {
		console.log(error)
		throw error
	}
}

exports.approveRequest = async (userId, friendId, meta, tenantCode) => {
	try {
		const requests = await sequelize.transaction(async (t) => {
			const deletedCount = await ConnectionRequest.destroy({
				where: {
					[Op.or]: [
						{ user_id: userId, friend_id: friendId },
						{ user_id: friendId, friend_id: userId },
					],
					status: common.CONNECTIONS_STATUS.REQUESTED,
					created_by: friendId,
					tenant_code: tenantCode,
				},
				individualHooks: true,
				transaction: t,
			})
			if (deletedCount != 2) {
				throw new Error('Error while deleting from "ConnectionRequest"')
			}

			const friendRequestData = [
				{
					user_id: userId,
					friend_id: friendId,
					status: common.CONNECTIONS_STATUS.ACCEPTED,
					created_by: friendId,
					updated_by: userId,
					tenant_code: tenantCode,
					meta,
				},
				{
					user_id: friendId,
					friend_id: userId,
					status: common.CONNECTIONS_STATUS.ACCEPTED,
					created_by: friendId,
					updated_by: userId,
					tenant_code: tenantCode,
					meta,
				},
			]

			const requests = await Connection.bulkCreate(friendRequestData, {
				transaction: t,
			})

			return requests
		})

		return requests
	} catch (error) {
		throw error
	}
}

exports.rejectRequest = async (userId, friendId, tenantCode) => {
	try {
		const updateData = {
			status: common.CONNECTIONS_STATUS.REJECTED,
			updated_by: userId,
			deleted_at: Date.now(),
		}

		return await ConnectionRequest.update(updateData, {
			where: {
				status: common.CONNECTIONS_STATUS.REQUESTED,
				[Op.or]: [
					{ user_id: userId, friend_id: friendId },
					{ user_id: friendId, friend_id: userId },
				],
				created_by: friendId,
				tenant_code: tenantCode,
			},
			individualHooks: true,
		})
	} catch (error) {
		throw error
	}
}
exports.findOneRequest = async (userId, friendId, tenantCode) => {
	try {
		const connectionRequest = await ConnectionRequest.findOne({
			where: {
				[Op.or]: [
					{ user_id: userId, friend_id: friendId },
					{ user_id: friendId, friend_id: userId },
				],
				status: common.CONNECTIONS_STATUS.REQUESTED,
				created_by: friendId,
				tenant_code: tenantCode,
			},
			raw: true,
		})

		return connectionRequest
	} catch (error) {
		throw error
	}
}

exports.checkPendingRequest = async (userId, friendId, tenantCode) => {
	try {
		const result = await ConnectionRequest.findOne({
			where: {
				user_id: userId,
				friend_id: friendId,
				status: common.CONNECTIONS_STATUS.REQUESTED,
				tenant_code: tenantCode,
			},
			raw: true,
		})
		return result
	} catch (error) {
		throw error
	}
}

exports.deleteUserConnectionsAndRequests = async (userId, tenantCode) => {
	try {
		const now = new Date()

		const modelsToUpdate = [
			{ model: ConnectionRequest, status: common.CONNECTIONS_STATUS.REQUESTED },
			{ model: Connection, status: common.CONNECTIONS_STATUS.ACCEPTED },
		]

		let deleted = false

		for (const { model, status } of modelsToUpdate) {
			const whereClause = {
				[Op.or]: [{ user_id: userId }, { friend_id: userId }],
				status,
				tenant_code: tenantCode,
			}

			const [affectedRows] = await model.update({ deleted_at: now }, { where: whereClause })

			if (affectedRows > 0) {
				deleted = true
			}
		}

		return deleted
	} catch (error) {
		throw error
	}
}

exports.getConnection = async (userId, friendId, tenantCode) => {
	try {
		const result = await Connection.findOne({
			where: {
				user_id: userId,
				friend_id: friendId,
				status: {
					[Op.or]: [common.CONNECTIONS_STATUS.ACCEPTED, common.CONNECTIONS_STATUS.BLOCKED],
				},
				tenant_code: tenantCode,
			},
			raw: true,
		})
		return result
	} catch (error) {
		throw error
	}
}

exports.getConnectionsByUserIds = async (userId, friendIds, tenantCode, projection) => {
	try {
		const defaultProjection = ['user_id', 'friend_id']

		const result = await Connection.findAll({
			where: {
				user_id: userId,
				friend_id: {
					[Op.in]: friendIds,
				},
				status: common.CONNECTIONS_STATUS.ACCEPTED,
				tenant_code: tenantCode,
			},
			attributes: projection || defaultProjection,
			raw: true,
		})
		return result
	} catch (error) {
		throw error
	}
}

exports.getConnectionsDetails = async (
	page,
	limit,
	filter,
	searchText = '',
	userId,
	organizationIds = [],
	roles = [],
	tenantCode
) => {
	try {
		let additionalFilter = ''
		let orgFilter = ''
		let filterClause = ''
		let rolesFilter = ''

		if (searchText) {
			additionalFilter = `AND name ILIKE :search`
		}

		if (organizationIds.length > 0) {
			orgFilter = `AND organization_id IN (:organizationIds)`
		}

		if (filter?.query?.length > 0) {
			filterClause = filter.query.startsWith('AND') ? filter.query : 'AND ' + filter.query
		}

		// Add the roles filter
		if (roles.includes('mentor') && roles.includes('mentee')) {
			// Show both mentors and mentees, no additional filter needed
		} else if (roles.includes('mentor')) {
			rolesFilter = `AND is_mentor = true`
		} else if (roles.includes('mentee')) {
			rolesFilter = `AND is_mentor = false`
		}

		const userFilterClause = `mv.user_id IN (SELECT friend_id FROM ${Connection.tableName} WHERE user_id = :userId)`

		const projectionClause = `
		mv.name,
		mv.user_id,
		mv.mentee_visibility,
		mv.organization_id,
		mv.designation,
		mv.experience,
		mv.is_mentor,
		mv.area_of_expertise,
		mv.education_qualification,
		mv.image,
		mv.custom_entity_text::JSONB AS custom_entity_text,
		mv.meta::JSONB AS user_meta,
		c.meta::JSONB AS connection_meta,
		mv.deleted_at AS user_deleted_at,
		c.deleted_at AS connections_deleted_at
		`

		let query = `
            SELECT ${projectionClause}
            FROM ${common.materializedViewsPrefix + MenteeExtension.tableName} mv
            LEFT JOIN ${Connection.tableName} c 
            ON c.friend_id = mv.user_id AND c.user_id = :userId
            WHERE ${userFilterClause}
            AND c.tenant_code = :tenantCode
            ${orgFilter}
            ${filterClause}
            ${rolesFilter}
            ${additionalFilter}
        `

		const replacements = {
			...filter?.replacements,
			search: `%${searchText}%`,
			userId,
			organizationIds,
			tenantCode,
		}

		if (page !== null && limit !== null) {
			query += `
                OFFSET :offset
                LIMIT :limit;
            `
			replacements.offset = limit * (page - 1)
			replacements.limit = limit
		}

		const connectedUsers = await sequelize.query(query, {
			type: QueryTypes.SELECT,
			replacements: replacements,
		})

		const countQuery = `
		    SELECT count(*) AS "count"
		    FROM ${common.materializedViewsPrefix + MenteeExtension.tableName} mv
		    LEFT JOIN ${Connection.tableName} c 
		    ON c.friend_id = mv.user_id AND c.user_id = :userId
		    WHERE ${userFilterClause}
		    AND c.tenant_code = :tenantCode
		    ${filterClause}
		    ${rolesFilter}
		    ${orgFilter}
		    ${additionalFilter};
		`
		const count = await sequelize.query(countQuery, {
			type: QueryTypes.SELECT,
			replacements: replacements,
		})

		return {
			data: connectedUsers,
			count: Number(count[0].count),
		}
	} catch (error) {
		throw error
	}
}

exports.updateConnection = async (userId, friendId, updateBody, tenantCode) => {
	try {
		const [rowsUpdated, updatedConnections] = await Connection.update(updateBody, {
			where: {
				[Op.or]: [
					{ user_id: userId, friend_id: friendId },
					{ user_id: friendId, friend_id: userId },
				],
				status: common.CONNECTIONS_STATUS.ACCEPTED,
				tenant_code: tenantCode,
			},
			returning: true,
			raw: true,
		})

		// Find and return the specific row
		const targetConnection = updatedConnections.find(
			(connection) => connection.user_id === userId && connection.friend_id === friendId
		)

		return targetConnection
	} catch (error) {
		throw error
	}
}

exports.getConnectionsCount = async (filter, userId, organizationIds = [], tenantCode) => {
	try {
		let orgFilter = ''
		let filterClause = ''
		let tenantFilter = ''

		if (organizationIds.length > 0) {
			orgFilter = `AND ue.organization_id IN (:organizationIds)`
		}

		tenantFilter = `AND ue.tenant_code = :tenantCode AND c.tenant_code = :tenantCode`

		if (filter?.query?.length > 0) {
			filterClause = filter.query.startsWith('AND') ? filter.query : 'AND ' + filter.query
		}

		const userFilterClause = `ue.user_id IN (SELECT friend_id FROM ${Connection.tableName} WHERE user_id = :userId)`

		const countQuery = `
			SELECT COUNT(*) AS count
			FROM ${MenteeExtension.tableName} ue
			LEFT JOIN ${Connection.tableName} c 
			ON c.friend_id = ue.user_id AND c.user_id = :userId
			WHERE ${userFilterClause}
			${orgFilter}
			${filterClause}
			${tenantFilter};
		`

		const replacements = {
			...filter?.replacements,
			userId,
			organizationIds,
			tenantCode,
		}

		const result = await sequelize.query(countQuery, {
			type: QueryTypes.SELECT,
			replacements,
		})

		return Number(result[0].count)
	} catch (error) {
		throw error
	}
}
