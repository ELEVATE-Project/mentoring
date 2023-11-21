const commonHelper = require('@commonTests')
const schema = require('./profileSchema')
// const decode = require('./middlewares/authenticator')

describe('mentoring/v1/profile', function () {
	beforeAll(async () => {
		await commonHelper.reActivateProfile()
	})

	it('/reActivate', async () => {
		let res = await request.post('/mentoring/v1/profile/reActivate')

		console.log(res.body)

		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.reActivateSchema)
	})
})
