'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			// Change columns to STRING
			await queryInterface.changeColumn('availabilities', 'user_id', {
				type: Sequelize.STRING,
				allowNull: false,
			})
			await queryInterface.changeColumn('feedbacks', 'user_id', {
				type: Sequelize.STRING,
				allowNull: false,
			})
			await queryInterface.changeColumn('issues', 'user_id', {
				type: Sequelize.STRING,
				allowNull: false,
			})
			await queryInterface.changeColumn('mentor_extensions', 'user_id', {
				type: Sequelize.STRING,
				allowNull: false,
			})
			// await queryInterface.changeColumn('session_ownerships', 'user_id', {
			// 	type: Sequelize.STRING,
			// 	allowNull: false,
			// })
			await queryInterface.changeColumn('user_extensions', 'user_id', {
				type: Sequelize.STRING,
				allowNull: false,
			})

			// Change mentor_id in sessions
			await queryInterface.changeColumn('sessions', 'mentor_id', {
				type: Sequelize.STRING,
				allowNull: false,
			})

			// Change mentee_id in session_attendees and session_enrollments
			await queryInterface.changeColumn('session_attendees', 'mentee_id', {
				type: Sequelize.STRING,
				allowNull: false,
			})
			await queryInterface.changeColumn('session_enrollments', 'mentee_id', {
				type: Sequelize.STRING,
				allowNull: false,
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	},

	down: async (queryInterface, Sequelize) => {
		// Revert changes back to INTEGER
		await queryInterface.changeColumn('availabilities', 'user_id', {
			type: Sequelize.INTEGER,
			allowNull: false,
		})
		await queryInterface.changeColumn('feedbacks', 'user_id', {
			type: Sequelize.INTEGER,
			allowNull: false,
		})
		await queryInterface.changeColumn('issues', 'user_id', {
			type: Sequelize.INTEGER,
			allowNull: false,
		})
		await queryInterface.changeColumn('mentor_extensions', 'user_id', {
			type: Sequelize.INTEGER,
			allowNull: false,
		})
		await queryInterface.changeColumn('session_ownerships', 'user_id', {
			type: Sequelize.INTEGER,
			allowNull: false,
		})
		await queryInterface.changeColumn('user_extensions', 'user_id', {
			type: Sequelize.INTEGER,
		})

		await queryInterface.changeColumn('sessions', 'mentor_id', {
			type: Sequelize.INTEGER,
			allowNull: false,
		})

		await queryInterface.changeColumn('session_attendees', 'mentee_id', {
			type: Sequelize.INTEGER,
			allowNull: false,
		})
		await queryInterface.changeColumn('session_enrollments', 'mentee_id', {
			type: Sequelize.INTEGER,
			allowNull: false,
		})
	},
}
