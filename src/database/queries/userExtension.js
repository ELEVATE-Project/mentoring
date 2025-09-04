const MenteeExtension = require('@database/models/index').UserExtension
const { QueryTypes } = require('sequelize')
const sequelize = require('sequelize')
const Sequelize = require('@database/models/index').sequelize
const common = require('@constants/common')
const _ = require('lodash')
const { Op } = require('sequelize')
const emailEncryption = require('@utils/emailEncryption')

module.exports = class MenteeExtensionQueries {
	static async getColumns() {
		try {
			return await Object.keys(MenteeExtension.rawAttributes)
		} catch (error) {
			return error
		}
	}

	static async getModelName() {
		try {
			return await MenteeExtension.name
		} catch (error) {
			return error
		}
	}
	static async createMenteeExtension(data, tenantCode) {
		try {
			data.tenant_code = tenantCode
			return await MenteeExtension.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async updateMenteeExtension(userId, data, options = {}, customFilter = {}, tenantCode) {
		try {
			if (data.user_id) {
				delete data['user_id']
			}
			let whereClause
			if (_.isEmpty(customFilter)) {
				whereClause = { user_id: userId, tenant_code: tenantCode }
			} else {
				whereClause = { ...customFilter, tenant_code: tenantCode }
			}

			// If `meta` is included in `data`, use `jsonb_set` to merge changes safely
			if (data.meta) {
				for (const [key, value] of Object.entries(data.meta)) {
					data.meta = Sequelize.fn(
						'jsonb_set',
						Sequelize.fn('COALESCE', Sequelize.col('meta'), '{}'), // Initializes `meta` if null
						`{${key}}`,
						JSON.stringify(value),
						true
					)
				}
			} else {
				delete data.meta
			}

			return await MenteeExtension.update(data, {
				where: whereClause,
				...options,
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	static async addVisibleToOrg(organizationId, newRelatedOrgs, options = {}, tenantCode) {
		// Update user extension and concat related org to the org id
		await MenteeExtension.update(
			{
				visible_to_organizations: sequelize.literal(
					`array_cat("visible_to_organizations", ARRAY[${newRelatedOrgs}]::integer[])`
				),
			},
			{
				where: {
					organization_id: organizationId,
					[Op.or]: [
						{
							[Op.not]: {
								visible_to_organizations: {
									[Op.contains]: newRelatedOrgs,
								},
							},
						},
						{
							visible_to_organizations: {
								[Op.is]: null,
							},
						},
					],
					tenant_code: tenantCode,
				},
				...options,
				individualHooks: true,
			}
		)
		// Update user extension and append org id to all the related orgs
		return await MenteeExtension.update(
			{
				visible_to_organizations: sequelize.literal(
					`COALESCE("visible_to_organizations", ARRAY[]::integer[]) || ARRAY[${organizationId}]::integer[]`
				),
			},
			{
				where: {
					organization_id: {
						[Op.in]: [...newRelatedOrgs],
					},
					[Op.or]: [
						{
							[Op.not]: {
								visible_to_organizations: {
									[Op.contains]: [organizationId],
								},
							},
						},
						{
							visible_to_organizations: {
								[Op.is]: null,
							},
						},
					],
					tenant_code: tenantCode,
				},
				individualHooks: true,
				...options,
			}
		)
	}

	static async removeVisibleToOrg(orgId, elementsToRemove) {
		const organizationUpdateQuery = `
		  UPDATE "user_extensions"
		  SET "visible_to_organizations" = (
			SELECT array_agg(elem)
			FROM unnest("visible_to_organizations") AS elem
			WHERE elem NOT IN (${elementsToRemove.join(',')})
		  )
		  WHERE organization_id = :orgId
		`

		await Sequelize.query(organizationUpdateQuery, {
			replacements: { orgId },
			type: Sequelize.QueryTypes.UPDATE,
		})
		const relatedOrganizationUpdateQuery = `
		  UPDATE "user_extensions"
		  SET "visible_to_organizations" = (
			SELECT array_agg(elem)
			FROM unnest("visible_to_organizations") AS elem
			WHERE elem NOT IN (${orgId})
		  )
		  WHERE organization_id IN (:elementsToRemove)
		`

		await Sequelize.query(relatedOrganizationUpdateQuery, {
			replacements: { elementsToRemove },
			type: Sequelize.QueryTypes.UPDATE,
		})
	}
	static async getMenteeExtension(userId, attributes = [], unScoped = false, tenantCode) {
		try {
			const queryOptions = {
				where: {
					user_id: userId,
					tenant_code: tenantCode,
				},
				raw: true,
			}

			// If attributes are passed update query
			if (attributes.length > 0) {
				queryOptions.attributes = attributes
			}

			let mentee
			if (unScoped) {
				mentee = await MenteeExtension.unscoped().findOne(queryOptions)
			} else {
				mentee = await MenteeExtension.findOne(queryOptions)
			}

			if (mentee && mentee.email) {
				mentee.email = await emailEncryption.decrypt(mentee.email.toLowerCase())
			}

			return mentee
		} catch (error) {
			throw error
		}
	}

	static async deleteMenteeExtension(userId, force = false, tenantCode) {
		try {
			const options = { where: { user_id: userId, tenant_code: tenantCode } }

			if (force) {
				options.force = true
			}
			return await MenteeExtension.destroy(options)
		} catch (error) {
			throw error
		}
	}
	static async removeMenteeDetails(userId, tenantCode) {
		try {
			const modelAttributes = MenteeExtension.rawAttributes

			const fieldsToNullify = {}

			for (const [key, attribute] of Object.entries(modelAttributes)) {
				// Skip primary key or explicitly excluded fields
				if (
					attribute.primaryKey ||
					key === 'user_id' ||
					key === 'organization_id' || // required field
					key === 'created_at' ||
					key === 'updated_at' ||
					key === 'is_mentor' // has default value
				) {
					continue
				}

				// Set types accordingly
				if (attribute.type.constructor.name === 'ARRAY') {
					fieldsToNullify[key] = []
				} else if (attribute.type.key === 'JSON' || attribute.type.key === 'JSONB') {
					fieldsToNullify[key] = {} // Or `{}` if you prefer default object
				} else if (key === 'deleted_at') {
					fieldsToNullify[key] = new Date() // Timestamp field
				} else if (key === 'name') {
					fieldsToNullify[key] = common.USER_NOT_FOUND
				} else {
					fieldsToNullify[key] = null
				}
			}

			return await MenteeExtension.update(fieldsToNullify, {
				where: {
					user_id: userId,
					tenant_code: tenantCode,
				},
			})
		} catch (error) {
			console.error('An error occurred:', error)
			throw error
		}
	}

	static async deleteMenteeExtension(userId, tenantCode) {
		try {
			// Completely delete the mentee extension record
			const result = await MenteeExtension.destroy({
				where: {
					user_id: userId,
					tenant_code: tenantCode,
				},
			})

			return result
		} catch (error) {
			return error
		}
	}

	static async getUsersByUserIds(ids, options = {}, tenantCode, unscoped = false) {
		try {
			const query = {
				where: {
					user_id: ids,
					tenant_code: tenantCode,
				},
				...options,
				returning: true,
				raw: true,
			}

			let result = unscoped
				? await MenteeExtension.unscoped().findAll(query)
				: await MenteeExtension.findAll(query)

			await Promise.all(
				result.map(async (userInfo) => {
					if (userInfo && userInfo.email) {
						userInfo.email = await emailEncryption.decrypt(userInfo.email.toLowerCase())
					}
				})
			)

			return result
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	static async getUsersByUserIdsFromView(
		ids,
		page,
		limit,
		filter,
		saasFilter = '',
		additionalProjectionclause = '',
		returnOnlyUserId,
		searchText = ''
	) {
		try {
			let additionalFilter = ''

			if (searchText) {
				additionalFilter = `AND name ILIKE :search`
			}
			if (Array.isArray(searchText)) {
				additionalFilter = `AND email IN ('${searchText.join("','")}')`
			}

			const excludeUserIds = ids.length === 0
			const userFilterClause = excludeUserIds ? '' : `user_id IN (${ids.join(',')})`

			let filterClause = filter?.query.length > 0 ? `${filter.query}` : ''

			let saasFilterClause = saasFilter !== '' ? saasFilter : ''
			if (excludeUserIds && filter.query.length === 0) {
				saasFilterClause = saasFilterClause.replace('AND ', '') // Remove "AND" if excludeUserIds is true and filter is empty
			}

			let projectionClause =
				'user_id,meta,mentee_visibility,organization_id,designation,area_of_expertise,education_qualification'

			if (returnOnlyUserId) {
				projectionClause = 'user_id'
			} else if (additionalProjectionclause !== '') {
				projectionClause += `,${additionalProjectionclause}`
			}

			if (userFilterClause && filter?.query.length > 0) {
				filterClause = filterClause.startsWith('AND') ? filterClause : 'AND' + filterClause
			}

			let query = `
				SELECT ${projectionClause}
				FROM
					${common.materializedViewsPrefix + MenteeExtension.tableName}
				WHERE
					${userFilterClause}
					${filterClause}
					${saasFilterClause}
					${additionalFilter}
			`

			const replacements = {
				...filter.replacements, // Add filter parameters to replacements
				search: `%${searchText}%`,
			}

			if (page !== null && limit !== null) {
				query += `
					OFFSET
						:offset
					LIMIT
						:limit;
				`

				replacements.offset = limit * (page - 1)
				replacements.limit = limit
			}

			const mentees = await Sequelize.query(query, {
				type: QueryTypes.SELECT,
				replacements: replacements,
			})

			const countQuery = `
			SELECT count(*) AS "count"
			FROM
				${common.materializedViewsPrefix + MenteeExtension.tableName}
			WHERE
				${userFilterClause}
				${filterClause}
				${saasFilterClause}
				${additionalFilter}
;
		`
			const count = await Sequelize.query(countQuery, {
				type: QueryTypes.SELECT,
				replacements: replacements,
			})

			return {
				data: mentees,
				count: Number(count[0].count),
			}
		} catch (error) {
			throw error
		}
	}
	static async getMenteeExtensions(userIds, attributes = [], tenantCode) {
		try {
			const queryOptions = { where: { user_id: { [Op.in]: userIds }, tenant_code: tenantCode }, raw: true }
			// If attributes are passed update query
			if (attributes.length > 0) {
				queryOptions.attributes = attributes
			}
			const mentee = await MenteeExtension.findAll(queryOptions)
			return mentee
		} catch (error) {
			throw error
		}
	}
	static async findOneFromView(userId, tenantCode) {
		try {
			let query = `
				SELECT *
				FROM ${common.materializedViewsPrefix + MenteeExtension.tableName}
				WHERE user_id = :userId AND tenant_code = :tenantCode
				LIMIT 1
			`
			const user = await Sequelize.query(query, {
				replacements: { userId, tenantCode },
				type: QueryTypes.SELECT,
			})

			return user.length > 0 ? user[0] : null
		} catch (error) {
			return error
		}
	}

	static async getAllUsers(
		ids,
		page,
		limit,
		filter,
		saasFilter = '',
		additionalProjectionClause = '',
		returnOnlyUserId,
		searchText = '',
		defaultFilter = '',
		tenantCode
	) {
		try {
			const excludeUserIds = ids.length === 0
			const userFilterClause = excludeUserIds ? '' : `user_id IN (${ids.map((id) => `'${id}'`).join(',')})`
			let additionalFilter = ''

			if (searchText) {
				additionalFilter = `AND name ILIKE :search`
			}
			if (Array.isArray(searchText)) {
				additionalFilter = `AND email IN ('${searchText.join("','")}')`
			}

			let filterClause = filter?.query.length > 0 ? `${filter.query}` : ''
			let saasFilterClause = saasFilter !== '' ? saasFilter : ''

			if (excludeUserIds && filter.query.length === 0) {
				saasFilterClause = saasFilterClause.replace('AND ', '') // Remove "AND" if excludeUserIds is true and filter is empty
			}

			// Tenant filtering enabled - materialized view now includes tenant_code column
			const tenantFilterClause = tenantCode ? `AND tenant_code = '${tenantCode}'` : ''

			let projectionClause = `
				user_id,
				name,
				email,
				organization_id,
				designation,
				area_of_expertise,
				education_qualification,
				mentee_visibility,
				custom_entity_text::JSONB AS custom_entity_text,
				meta::JSONB AS meta
			`
			if (returnOnlyUserId) {
				projectionClause = 'user_id'
			} else if (additionalProjectionClause !== '') {
				projectionClause += `, ${additionalProjectionClause}`
			}

			if (userFilterClause && filter?.query.length > 0) {
				filterClause = filterClause.startsWith('AND') ? filterClause : 'AND ' + filterClause
			}

			// Build WHERE clause dynamically to avoid empty conditions
			const whereConditions = [
				userFilterClause,
				filterClause,
				saasFilterClause,
				additionalFilter,
				defaultFilter,
				tenantFilterClause,
			].filter((condition) => condition && condition.trim() !== '')

			let whereClause = ''
			if (whereConditions.length > 0) {
				// Clean up AND prefixes and join conditions
				const cleanedConditions = whereConditions.map((condition, index) => {
					if (index === 0) {
						// First condition shouldn't have AND prefix
						return condition.replace(/^AND\s+/, '')
					}
					// Subsequent conditions should have AND prefix
					return condition.startsWith('AND ') ? condition : `AND ${condition}`
				})
				whereClause = `WHERE ${cleanedConditions.join(' ')}`
			}

			const query = `
				SELECT ${projectionClause}
				FROM ${common.materializedViewsPrefix + MenteeExtension.tableName}
				${whereClause}
				OFFSET :offset
				LIMIT :limit
			`

			const replacements = {
				...filter.replacements, // Add filter parameters to replacements
				search: `%${searchText}%`,
			}

			// Always provide offset and limit replacements since they're in the query
			if (page !== null && limit !== null) {
				replacements.offset = limit * (page - 1)
				replacements.limit = limit
			} else {
				// Provide defaults if page/limit not specified
				replacements.offset = 0
				replacements.limit = 5 // Default limit
			}

			let results = await Sequelize.query(query, {
				type: QueryTypes.SELECT,
				replacements: replacements,
			})

			const countQuery = `
				SELECT COUNT(*) AS count
				FROM ${common.materializedViewsPrefix + MenteeExtension.tableName}
				WHERE
					${userFilterClause}
					${filterClause}
					${saasFilterClause}
					${additionalFilter}
					${defaultFilter}
			`

			const count = await Sequelize.query(countQuery, {
				type: QueryTypes.SELECT,
				replacements: replacements,
			})

			return {
				data: results,
				count: Number(count[0].count),
			}
		} catch (error) {
			throw error
		}
	}
	static async getAllUsersByIds(ids, tenantCode) {
		try {
			const excludeUserIds = ids.length === 0
			const userFilterClause = excludeUserIds ? '' : `user_id IN (${ids.map((id) => `'${id}'`).join(',')})`
			const tenantFilterClause = tenantCode ? `tenant_code = '${tenantCode}'` : ''

			// Combine filters with proper AND logic
			let whereClause = ''
			if (userFilterClause && tenantFilterClause) {
				whereClause = `${userFilterClause} AND ${tenantFilterClause}`
			} else if (userFilterClause) {
				whereClause = userFilterClause
			} else if (tenantFilterClause) {
				whereClause = tenantFilterClause
			} else {
				whereClause = '1=1' // Default to all records if no filters
			}

			const query = `
				SELECT *
				FROM ${common.materializedViewsPrefix + MenteeExtension.tableName}
				WHERE
					${whereClause}
				`

			const results = await Sequelize.query(query, {
				type: QueryTypes.SELECT,
			})
			return results
		} catch (error) {
			throw error
		}
	}

	/**
	 * Retrieves users from the database based on the provided email IDs.
	 *
	 * This static method constructs and executes a SQL query to fetch users whose email
	 * addresses are provided in the `emailIds` array. It returns an array of user records
	 * matching the given email IDs.
	 *
	 * @param {Array<string>} emailIds - An array of email IDs to filter the users by.
	 * @returns {Promise<Array<object>>} - A promise that resolves to an array of user objects.
	 *
	 * @example
	 * const emailIds = ['user1@example.com', 'user2@example.com'];
	 * const users = await getUsersByEmailIds(emailIds);
	 * console.log(users); // Outputs an array of user records matching the provided email IDs.
	 */
	static async getUsersByEmailIds(emailIds, tenantCode) {
		try {
			const emailFilterClause =
				emailIds.length === 0 ? '' : `email IN (${emailIds.map((id) => `'${id}'`).join(',')})`
			const tenantFilterClause = tenantCode ? `tenant_code = '${tenantCode}'` : ''

			// Combine filters with proper AND logic
			let whereClause = ''
			if (emailFilterClause && tenantFilterClause) {
				whereClause = `${emailFilterClause} AND ${tenantFilterClause}`
			} else if (emailFilterClause) {
				whereClause = emailFilterClause
			} else if (tenantFilterClause) {
				whereClause = tenantFilterClause
			} else {
				whereClause = '1=1' // Default to all records if no filters
			}

			const query = `
				SELECT *
				FROM ${common.materializedViewsPrefix + MenteeExtension.tableName}
				WHERE
					${whereClause}
				`

			const results = await Sequelize.query(query, {
				type: QueryTypes.SELECT,
			})
			return results
		} catch (error) {
			throw error
		}
	}
}
