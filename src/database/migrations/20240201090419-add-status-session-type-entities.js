'use strict'
/** @type {import('sequelize-cli').Migration} */
const entitiesArray = {
	type: [
		{
			label: 'Public',
			value: 'PUBLIC',
		},
		{
			label: 'Private',
			value: 'PRIVATE',
		},
	],
	status: [
		{
			value: 'COMPLETED',
			label: 'Completed',
		},
		{
			value: 'UNFULFILLED',
			label: 'Unfulfilled',
		},
		{
			value: 'PUBLISHED',
			label: 'Published',
		},
		{
			value: 'LIVE',
			label: 'Live',
		},
		{
			value: 'ACTIVE',
			label: 'Active',
		},
		{
			value: 'INACTIVE',
			label: 'Inactive',
		},
	],
}

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		// Check if data already exists for the given values and organization
		const existingEntityTypes = await queryInterface.sequelize.query(
			'SELECT id, value FROM entity_types WHERE value IN (:value) AND organization_id = :organization_id',
			{
				replacements: { value: Object.keys(entitiesArray), organization_id: defaultOrgId },
				type: Sequelize.QueryTypes.SELECT,
			}
		)

		// Remove existing types from entitiesArray
		existingEntityTypes.forEach((existingType) => {
			const typeIndex = Object.keys(entitiesArray).indexOf(existingType.value)
			if (typeIndex !== -1) {
				delete entitiesArray[Object.keys(entitiesArray)[typeIndex]]
			}
		})

		// Check if entitiesArray is empty
		if (Object.keys(entitiesArray).length === 0) {
			console.log('All entity types data already exists. Skipping migration.')
			return
		}

		const entityTypeFinalArray = Object.keys(entitiesArray).map((key) => {
			const entityTypeRow = {
				value: key,
				label: convertToWords(key),
				data_type: 'STRING',
				status: 'ACTIVE',
				updated_at: new Date(),
				created_at: new Date(),
				created_by: 0,
				updated_by: 0,
				allow_filtering: true,
				organization_id: defaultOrgId,
				has_entities: true,
				model_names: ['Session'],
				allow_custom_entities: false,
			}

			return entityTypeRow
		})

		// Add entity_types based on the input
		await queryInterface.bulkInsert('entity_types', entityTypeFinalArray, {})

		const entityTypes = await queryInterface.sequelize.query('SELECT * FROM entity_types', {
			type: queryInterface.sequelize.QueryTypes.SELECT,
		})

		const entitiesFinalArray = []

		entityTypes.forEach((eachType) => {
			if (eachType.value in entitiesArray) {
				entitiesArray[eachType.value].forEach((eachEntity) => {
					eachEntity.entity_type_id = eachType.id
					eachEntity.type = 'SYSTEM'
					eachEntity.status = 'ACTIVE'
					eachEntity.created_at = new Date()
					eachEntity.updated_at = new Date()
					eachEntity.created_by = 0

					entitiesFinalArray.push(eachEntity)
				})
			}
		})
		await queryInterface.bulkInsert('entities', entitiesFinalArray, {})
	},

	down: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const deletedEntityTypes = await queryInterface.sequelize.query(
			'DELETE FROM entity_types WHERE value IN (:value) AND organization_id = :organization_id RETURNING id',
			{
				replacements: { value: Object.keys(entitiesArray), organization_id: defaultOrgId },
				type: Sequelize.QueryTypes.DELETE,
			}
		)

		if (deletedEntityTypes && deletedEntityTypes.length > 0) {
			const deletedEntityTypeIds = deletedEntityTypes.map((entityType) => entityType.id)

			await queryInterface.sequelize.query('DELETE FROM entities WHERE entity_type_id IN (:entityTypeIds)', {
				replacements: { entityTypeIds: deletedEntityTypeIds },
				type: Sequelize.QueryTypes.DELETE,
			})
		}
	},
}

function convertToWords(inputString) {
	const words = inputString.replace(/_/g, ' ').split(' ')

	const capitalizedWords = words.map((word) => {
		return word.charAt(0).toUpperCase() + word.slice(1)
	})

	const result = capitalizedWords.join(' ')

	return result
}
