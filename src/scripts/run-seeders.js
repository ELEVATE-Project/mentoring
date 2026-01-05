const Umzug = require('umzug')
const path = require('path')
const { sequelize } = require('../database/models/index') // adjust path if needed

async function runSeeders() {
	const umzug = new Umzug({
		storage: 'sequelize',
		storageOptions: {
			sequelize,
		},
		migrations: {
			path: path.join(__dirname, '../database/seeders'),
			pattern: /\.js$/,
			params: [sequelize.getQueryInterface(), sequelize.constructor],
		},
		logging: console.log,
	})

	try {
		console.log('Running seeders...')
		await umzug.up() // <-- BLOCKS until all seeds are done
		console.log('SEEDER_SUCCESS')
		process.exit(0)
	} catch (err) {
		console.error('Seeding failed:', err)
		process.exit(1)
	}
}

runSeeders()
