'use strict'
require('dotenv').config({ path: '../../.env' })
module.exports = (sequelize, DataTypes) => {
	const Feedback = sequelize.define(
		'Feedback',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			session_id: { type: DataTypes.INTEGER, allowNull: false },
			question_id: { type: DataTypes.INTEGER, allowNull: false },
			response: { type: DataTypes.STRING },
			meta: {
				type: DataTypes.JSON,
			},
			user_id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
			organization_code: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: process.env.DEFAULT_ORG_CODE,
			},
			tenant_code: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: process.env.DEFAULT_TENANT_CODE,
			},
		},
		{ sequelize, modelName: 'Feedback', tableName: 'feedbacks', freezeTableName: true, paranoid: true }
	)

	Feedback.associate = (models) => {
		Feedback.belongsTo(models.Session, {
			foreignKey: 'session_id',
			as: 'session',
			scope: {
				deleted_at: null,
			},
		})
	}

	return Feedback
}
