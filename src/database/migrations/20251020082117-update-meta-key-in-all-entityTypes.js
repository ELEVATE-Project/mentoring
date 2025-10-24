'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()
		try {
			const [entityTypes] = await queryInterface.sequelize.query(
				`
        SELECT * FROM entity_types 
        WHERE 
          status = 'ACTIVE' 
          AND deleted_at IS NULL 
          AND model_names && ARRAY['MentorExtension', 'UserExtension']::varchar[];
        `,
				{ transaction }
			)

			const entityUpdate = {
				designation: {
					label: 'Designation',
					visible: true,
					visibility: 'main',
					sequence: 1,
				},
				area_of_expertise: {
					label: 'Area Of Expertise',
					visible: true,
					visibility: 'main',
					sequence: 1,
				},
			}

			for (const entityType of entityTypes) {
				let meta
				if (entityUpdate.hasOwnProperty(entityType.value)) {
					meta = entityUpdate[entityType.value]
				} else {
					meta = {
						label: entityType.label,
						visible: true,
						visibility: 'main',
					}
				}

				await queryInterface.sequelize.query(
					`
              UPDATE entity_types
              SET meta = :meta
              WHERE value = :entityValue
            `,
					{
						replacements: {
							meta: JSON.stringify(meta),
							entityValue: entityType.value,
						},
						type: Sequelize.QueryTypes.UPDATE,
						transaction,
					}
				)
			}

			await transaction.commit()
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	},

	async down(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()
		try {
			await queryInterface.sequelize.query(
				`
        UPDATE entity_types
        SET meta = NULL
        WHERE 
          status = 'ACTIVE' 
          AND deleted_at IS NULL 
          AND model_names IN ('MentorExtension', 'UserExtension')
          AND value IN (
            'designation',
            'area_of_expertise',
            'experience',
            'education_qualification',
            'languages'
          );
        `,
				{ transaction }
			)

			await transaction.commit()
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	},
}
