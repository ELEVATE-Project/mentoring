var supertest = require('supertest') //require supertest
var defaults = require('superagent-defaults')
const { faker } = require('@faker-js/faker')
const crypto = require('crypto')
const common = require('@constants/common')
let baseURL = 'http://localhost:3000'
//supertest hits the HTTP server (your app)
let defaultHeaders
let admin_secret_code = process.env.ADMIN_SECRET_CODE || 'ADMIN_SECRET_CODE'

const logIn = async () => {
	try {
		let request = defaults(supertest('http://localhost:3001'))
		let waitOn = require('wait-on')
		let opts = {
			resources: [baseURL],
			delay: 1000, // initial delay in ms, default 0
			interval: 1000, // poll interval in ms, default 250ms
			timeout: 60000,
		}
		await waitOn(opts)
		let email = 'adithya' + crypto.randomBytes(5).toString('hex') + '@tunerlabs.com'
		let password = faker.internet.password()
		let res = await request.post('/user/v1/account/create').set('origin', 'localhost').send({
			name: 'adithya',
			email: email,
			password: 'PassworD@@@123',
			role: common.MENTEE_ROLE,
		})

		res = await request.post('/user/v1/account/login').set('origin', 'localhost').send({
			identifier: email,
			password: 'PassworD@@@123',
		})

		await waitForProfileExtension(res.body.result.access_token)

		if (res.body.result.access_token && res.body.result.user.id) {
			defaultHeaders = {
				'x-auth-token': 'bearer ' + res.body.result.access_token,
				Connection: 'keep-alive',
				'Content-Type': 'application/json',
			}
			global.request = defaults(supertest(baseURL))
			global.request.set(defaultHeaders)
			global.userId = res.body.result.user.id

			const userDetails = {
				token: res.body.result.access_token,
				refreshToken: res.body.result.refresh_token,
				userId: res.body.result.user.id,
				email: email,
				password: password,
				organizations: res.body.result.user.organizations,
			}

			return userDetails
		} else {
			console.error('Error while getting access token')
			return false
		}
	} catch (error) {
		console.error(error)
	}
}
const mentorLogIn = async () => {
	try {
		let request = defaults(supertest('http://localhost:3001'))
		var waitOn = require('wait-on')
		var opts = {
			resources: [baseURL],
			delay: 1000, // initial delay in ms, default 0
			interval: 500, // poll interval in ms, default 250ms
			timeout: 30000,
		}
		await waitOn(opts)
		let email = 'nevil' + crypto.randomBytes(5).toString('hex') + '@tunerlabs.com'
		let password = faker.internet.password()

		let res = await request.post('/user/v1/account/create').set('origin', 'localhost').send({
			name: 'Nevil',
			email: email,
			password: 'PassworD@@@123',
			isAMentor: true,
			secretCode: 'secret-code',
		})

		console.log(res.body, '<-- 87')

		res = await request.post('/user/v1/account/login').set('origin', 'localhost').send({
			identifier: email,
			password: 'PassworD@@@123',
		})
		await waitForProfileExtension(res.body.result.access_token)
		if (res.body.result.access_token && res.body.result.user.id) {
			defaultHeaders = {
				'x-auth-token': 'bearer ' + res.body.result.access_token,
				Connection: 'keep-alive',
				'Content-Type': 'application/json',
			}
			global.request = defaults(supertest(baseURL))
			global.request.set(defaultHeaders)
			global.userId = res.body.result.user.id

			const mentorDetails = {
				token: res.body.result.access_token,
				refreshToken: res.body.result.refresh_token,
				userId: res.body.result.user.id,
				email: email,
				password: password,
				organizations: res.body.result.user.organizations,
			}

			return mentorDetails
		} else {
			console.error('Error while getting access token')
			return false
		}
	} catch (error) {
		console.error(error)
	}
}
const adminLogin = async () => {
	try {
		let request = defaults(supertest('http://localhost:3001'))
		var waitOn = require('wait-on')
		var opts = {
			resources: [baseURL],
			delay: 1000, // initial delay in ms, default 0
			interval: 500, // poll interval in ms, default 250ms
			timeout: 30000,
		}
		await waitOn(opts)
		let email = 'system' + crypto.randomBytes(5).toString('hex') + '@admin.com'
		let password = 'PASSword###11'

		let adminCreate = await request
			.post('/user/v1/admin/create')
			.set('internal_access_token', 'internal_access_token') //NOTE: Please replace {{internal_access_token}} with your actual token
			.send({
				name: 'system',
				email: email,
				password: password,
				secret_code: admin_secret_code,
			})

		let res = await request.post('/user/v1/admin/login').set('origin', 'localhost').send({
			identifier: email,
			password: password,
		})
		await waitForProfileExtension(res.body.result.access_token)
		if (res.body.result.access_token && res.body.result.user.id) {
			defaultHeaders = {
				'x-auth-token': 'bearer ' + res.body.result.access_token,
				Connection: 'keep-alive',
				'Content-Type': 'application/json',
			}
			global.request = defaults(supertest(baseURL))
			global.request.set(defaultHeaders)
			global.userId = res.body.result.user.id

			const adminDetails = {
				token: res.body.result.access_token,
				refreshToken: res.body.result.refresh_token,
				userId: res.body.result.user.id,
				email: email,
				password: password,
				organizations: res.body.result.user.organizations,
			}

			return adminDetails
		} else {
			console.error('Error while getting access token')
			return false
		}
	} catch (error) {
		console.error(error)
	}
}
function logError(res) {
	let successCodes = [200, 201, 202]
	if (!successCodes.includes(res.statusCode)) {
		console.log('Response Body', res.body)
	}
}

const waitForProfileExtension = async (token, timeoutMs = 15000) => {
	const start = Date.now()

	while (Date.now() - start < timeoutMs) {
		try {
			let request = defaults(supertest('http://localhost:3000'))
			const res = await request
				.get(`/mentoring/v1/profile/getExtension`)
				.set('x-auth-token', token)
				.set('origin', 'localhost')

			if (res.status === 200 && res.body && res.body.result) {
				return res.body.result
			}
		} catch (error) {}

		await new Promise((r) => setTimeout(r, 300))
	}

	throw new Error('Profile extension not ready within timeout')
}

module.exports = {
	logIn, //-- export if token is generated
	logError,
	mentorLogIn,
	adminLogin,
}
