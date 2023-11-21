const commonHelper = require('@commonTests')
const schema = require('./entitytypeSchema')

describe('mentoring/v1/entity-type', function () {
	beforeAll(async () => {
		await commonHelper.logIn()
	})

	it('/create', async () => {
		let res = await request.post('/mentoring/v1/entity-type/create').send({
			value: 'med',
			label: 'Med',
			type: 'SYSTEM',
			status: 'ACTIVE',
			allow_filtering: true,
			data_type: 'STRING',
		})
		//console.log(res.body)

		expect(res.statusCode).toBe(201)
		expect(res.body).toMatchSchema(schema.createEntitySchema)
	})

	it('/read', async () => {
		let res = await request.get('/mentoring/v1/entity-type/read')
		//console.log(res.body)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.readEntityTypeSchema)
	})

	it('/read', async () => {
		let res = await request.get('/mentoring/v1/entity-type/read').send({
			value: ['recommended_for'],
		})
		//console.log(res.body)
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchSchema(schema.readEntityTypeWithEntitiesSchema)
	})

	it('/delete', async () => {
		const idToBeDeleted = 2
		let res = await request.delete('/mentoring/v1/entity-type/delete/25')

		//console.log(res.body)
		expect(res.statusCode).toBe(202)
		expect(res.body).toMatchSchema(schema.deleteEntitySchema)
	})
})
