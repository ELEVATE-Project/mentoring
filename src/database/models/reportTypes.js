'use strict'

module.exports = (sequelize, DataTypes) => {
	const ReportType = sequelize.define(
		'ReportType',
		{
			id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
			},
			title: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			created_at: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
			updated_at: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
			deleted_at: {
				type: DataTypes.DATE,
			},
		},
		{
			modelName: 'ReportType',
			tableName: 'report_types',
			freezeTableName: true,
			paranoid: true, // Enables soft delete handling via deleted_at
			indexes: [
				{
					unique: true,
					fields: ['title'],
					where: {
						deleted_at: null, // Unique only when deleted_at is NULL
					},
				},
			],
		}
	)

	return ReportType
}
