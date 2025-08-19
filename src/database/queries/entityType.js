const EntityType = require('../models/index').EntityType
const Entity = require('../models/index').Entity
const { Op } = require('sequelize')
//const Sequelize = require('../models/index').sequelize

module.exports = class UserEntityData {
	static async createEntityType(data, tenantCode) {
		try {
			data.tenant_code = tenantCode
			return await EntityType.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findOneEntityType(filter, tenantCode, options = {}) {
		try {
			filter.tenant_code = tenantCode
			return await EntityType.findOne({
				where: filter,
				...options,
				raw: true,
			})
		} catch (error) {
			throw error
		}
	}

	static async findAllEntityTypes(orgCodes, tenantCodes, attributes, filter = {}) {
		try {
			const entityData = await EntityType.findAll({
				where: {
					organization_code: orgCodes,
					tenant_code: tenantCodes,
					...filter,
				},
				attributes,
				raw: true,
			})
			return entityData
		} catch (error) {
			return error
		}
	}
	static async findUserEntityTypesAndEntities(filter, tenantCodes) {
		try {
			// Only add tenant_code to filter if tenantCode is provided
			if (tenantCodes) {
				filter.tenant_code = tenantCodes
			}

			const entityTypes = await EntityType.findAll({
				where: filter,
				raw: true,
			})

			const entityTypeIds = entityTypes.map((entityType) => entityType.id).filter((id) => id != null)

			let entities = []
			if (entityTypeIds.length > 0) {
				const entityFilter = {
					entity_type_id: entityTypeIds,
					status: 'ACTIVE',
				}

				// Only add tenant_code to entity filter if tenantCode is provided
				if (tenantCodes) {
					entityFilter.tenant_code = tenantCodes
				}

				entities = await Entity.findAll({
					where: entityFilter,
					raw: true,
					//attributes: { exclude: ['entity_type_id'] },
				})
			}

			const result = entityTypes.map((entityType) => {
				const matchingEntities = entities.filter((entity) => entity.entity_type_id === entityType.id)
				return {
					...entityType,
					entities: matchingEntities,
				}
			})

			return result
		} catch (error) {
			console.error('Error fetching data:', error)
			throw error
		}
	}

	/* 	static async findUserEntityTypesAndEntitiesRaw(filter) {
		try {
			const [result, metadata] = await Sequelize.query(
				`SELECT
				et.*,
				jsonb_agg(e.*) AS entities
			FROM
				entity_types et
			LEFT JOIN
				entities e ON et.id = e.entity_type_id
			WHERE
				et.status = 'ACTIVE'
				AND et.value IN ('medium')
				AND et.organization_id IN (1,1)
			GROUP BY
				et.id
			ORDER BY
				et.id;`
			)
			return result
		} catch (error) {
			console.error('Error fetching data:', error)
			throw error
		}
	} */

	static async updateOneEntityType(id, orgCode, tenantCode, update, options = {}) {
		try {
			return await EntityType.update(update, {
				where: {
					id: id,
					organization_code: orgCode,
					tenant_code: tenantCode,
				},
				...options,
			})
		} catch (error) {
			throw error
		}
	}

	static async deleteOneEntityType(id, organizationCode, tenantCode) {
		try {
			return await EntityType.destroy({
				where: {
					id: id,
					organization_code: organizationCode,
					tenant_code: tenantCode,
				},
				individualHooks: true,
			})
		} catch (error) {
			throw error
		}
	}

	static async findEntityTypeById(id, tenantCode) {
		try {
			return await EntityType.findOne({
				where: { id: id, tenant_code: tenantCode },
			})
		} catch (error) {
			return error
		}
	}

	static async findAllEntityTypesAndEntities(filter, tenantCode) {
		try {
			filter.tenant_code = tenantCode
			const entityTypes = await EntityType.findAll({
				where: filter,
				raw: true,
			})

			const entityTypeIds = entityTypes.map((entityType) => entityType.id)

			// Fetch all matching entities using the IDs
			const entities = await Entity.findAll({
				where: { entity_type_id: entityTypeIds, status: 'ACTIVE', tenant_code: tenantCode },
				raw: true,
				//attributes: { exclude: ['entity_type_id'] },
			})

			const result = entityTypes.map((entityType) => {
				const matchingEntities = entities.filter((entity) => entity.entity_type_id === entityType.id)
				return {
					...entityType,
					entities: matchingEntities,
				}
			})
			return result
		} catch (error) {
			return error
		}
	}

	static async deleteEntityTypesAndEntities(filter, tenantCode) {
		try {
			// Step 1: Find all entityTypes where the filter conditions are met (e.g., status is ACTIVE and certain values in 'value' column)
			filter.tenant_code = tenantCode
			const entityTypes = await EntityType.findAll({
				where: filter,
				raw: true,
			})

			const entityTypeIds = entityTypes.map((entityType) => entityType.id)

			if (entityTypeIds.length > 0) {
				// Step 2: Fetch all matching entities using the entityType IDs
				const entities = await Entity.findAll({
					where: { entity_type_id: entityTypeIds, status: 'ACTIVE', tenant_code: tenantCode },
					raw: true,
				})

				// Step 3: Prepare result with entityTypes and their associated entities
				const result = entityTypes.map((entityType) => {
					const matchingEntities = entities.filter((entity) => entity.entity_type_id === entityType.id)
					return {
						...entityType,
						entities: matchingEntities,
					}
				})

				// Step 4: Delete the entities and entityTypes
				await Entity.destroy({
					where: { entity_type_id: entityTypeIds, tenant_code: tenantCode },
					individualHooks: true,
				})

				await EntityType.destroy({
					where: { id: entityTypeIds, tenant_code: tenantCode },
					individualHooks: true,
				})
				return result
			} else {
				console.log('No matching entity types found')
				return []
			}
		} catch (error) {
			return error
		}
	}
}
