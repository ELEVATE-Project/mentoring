/**
 * name : health.config.js.
 * author : Mallanagouda R Biradar
 * created-date : 30-Jun-2025
 * Description : Health check config file
 */

module.exports = {
	name: process.env.SERVICE_NAME,
	version: '1.0.0',
	enableAdvancedCheck: true,
	checks: {
		kafka: {
			enabled: true,
			url: process.env.KAFKA_URL,
			topic: process.env.KAFKA_HEALTH_CHECK_TOPIC,
			groupId: process.env.KAFKA_GROUP_ID,
		},
		postgres: {
			enabled: true,
			url: process.env.DEV_DATABASE_URL,
		},
		redis: {
			enabled: true,
			url: process.env.REDIS_HOST,
		},
		microservices: [
			{
				name: 'UserService',
				url: `${process.env.USER_SERVICE_HOST}/user/health?serviceName=${process.env.SERVICE_NAME}`,
				enabled: true,
				request: {
					method: 'GET',
					header: {},
					body: {},
				},

				expectedResponse: {
					status: 200,
					'params.status': 'successful',
					'result.healthy': true,
				},
			},
			{
				name: 'SchedulerService',
				url: `${process.env.SCHEDULER_SERVICE_HOST}/scheduler/health?serviceName=${process.env.SERVICE_NAME}`,
				enabled: true,
				request: {
					method: 'GET',
					header: {},
					body: {},
				},

				expectedResponse: {
					status: 200,
					'params.status': 'successful',
					'result.healthy': true,
				},
			},
		],
	},
}
