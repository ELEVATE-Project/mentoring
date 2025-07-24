require('dotenv').config()
module.exports = (sequelize, DataTypes) => {
	const QuestionSet = sequelize.define(
		'QuestionSet',
		{
			id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				autoIncrement: true,
			},
			questions: {
				type: DataTypes.ARRAY(DataTypes.STRING),
				allowNull: true,
			},
			code: {
				type: DataTypes.STRING,
				allowNull: false,
				primaryKey: true,
			},
			organization_code: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: process.env.DEFAULT_ORG_CODE,
			},
			tenant_code: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: process.env.DEFAULT_TENANT_CODE,
				primaryKey: true,
			},
			status: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: 'PUBLISHED',
			},
			meta: {
				type: DataTypes.JSON,
				allowNull: true,
			},
			created_by: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			updated_by: {
				type: DataTypes.STRING,
				allowNull: true,
			},
		},
		{ sequelize, modelName: 'QuestionSet', tableName: 'question_sets', freezeTableName: true, paranoid: true }
	)

	return QuestionSet
}
