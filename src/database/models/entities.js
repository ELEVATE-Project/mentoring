'use strict'
module.exports = (sequelize, DataTypes) => {
	const Entity = sequelize.define(
		'Entity',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			entity_type_id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
			value: { type: DataTypes.STRING, allowNull: false },
			label: { type: DataTypes.STRING, allowNull: false },
			status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ACTIVE' },
			type: { type: DataTypes.STRING },
			created_by: { type: DataTypes.STRING, allowNull: true },
			updated_by: { type: DataTypes.STRING, allowNull: true },
			organization_code: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: 'DEFAULT_ORG',
			},
			tenant_code: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: 'DEFAULT_TENANT',
			},
		},
		{ sequelize, modelName: 'Entity', tableName: 'entities', freezeTableName: true, paranoid: true }
	)
	Entity.associate = (models) => {
		Entity.belongsTo(models.EntityType, {
			foreignKey: 'entity_type_id',
			as: 'entity_type',
			scope: {
				deleted_at: null, // Only associate with active EntityType records
			},
		})
	}
	return Entity
}
