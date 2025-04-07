require('module-alias/register')
require('dotenv').config()

let environmentData = require('../envVariables')()

if (!environmentData.success) {
	logger.error('Server could not start . Not all environment variable is provided', {
		triggerNotification: true,
	})
	process.exit()
}

const defaultOrgId =
	process.env.DEFAULT_ORG_ID.toString() ||
	(() => {
		throw new Error(
			'DEFAULT_ORG_ID is not defined in env. Run the script called insertDefaultOrg.js in /scripts folder.'
		)
	})()

module.exports = {
	development: {
		url: process.env.DEV_DATABASE_URL,
		dialect: 'postgres',
		migrationStorageTableName: 'sequelize_meta',
		define: {
			underscored: true,
			freezeTableName: true,
			paranoid: true,
			syncOnAssociation: true,
			charset: 'utf8',
			collate: 'utf8_general_ci',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: 'updated_at',
			deletedAt: 'deleted_at',
			logging: false,
		},
		defaultOrgId: defaultOrgId,
		pool: {
			max: parseInt(process.env.DB_POOL_MAX_CONNECTIONS), // Max number of connections in the pool (default to 5)
			//	min: parseInt(process.env.DB_POOL_MIN_CONNECTIONS), // Min number of connections in the pool (default to 0)
			idle: parseInt(process.env.DB_POOL_IDLE_TIMEOUT), // Idle timeout in milliseconds (default to 10 seconds)
			acquire: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT), // Acquire timeout in milliseconds (default to 30 seconds)
		},
	},
	test: {
		url: process.env.TEST_DATABASE_URL,
		dialect: 'postgres',
		defaultOrgId: defaultOrgId,
	},
	production: {
		url: process.env.DATABASE_URL,
		dialect: 'postgres',
		defaultOrgId: defaultOrgId,
	},
}
