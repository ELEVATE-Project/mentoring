'use strict'
const common = require('@constants/common')
module.exports = (sequelize, DataTypes) => {
	const Tenant = sequelize.define(
		'Tenant',
		{
			code: {
				type: DataTypes.STRING(255),
				allowNull: false,
				primaryKey: true,
			},
			name: {
				type: DataTypes.STRING(255),
				allowNull: false,
			},
			status: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: common.ACTIVE_STATUS,
			},
			description: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
			logo: {
				type: DataTypes.STRING(500),
				allowNull: true,
			},
			meta: {
				type: DataTypes.JSONB,
				allowNull: true,
			},
			theming: {
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
		{
			sequelize,
			modelName: 'Tenant',
			tableName: 'tenants',
			freezeTableName: true,
			paranoid: true,
		}
	)

	return Tenant
}
