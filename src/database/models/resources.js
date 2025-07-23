require('dotenv').config({ path: '../../.env' })
module.exports = (sequelize, DataTypes) => {
	const Resource = sequelize.define(
		'Resources',
		{
			id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				primaryKey: true,
				autoIncrement: true,
			},
			session_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			status: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: 'ACTIVE',
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			link: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			type: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			mime_type: {
				type: DataTypes.STRING,
				allowNull: true,
				defaultValue: null,
			},
			created_by: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			updated_by: {
				type: DataTypes.STRING,
				allowNull: true,
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
			},
			created_at: {
				allowNull: false,
				type: DataTypes.DATE,
				defaultValue: DataTypes.NOW,
			},
			updated_at: {
				allowNull: false,
				type: DataTypes.DATE,
				defaultValue: DataTypes.NOW,
			},
		},
		{ sequelize, modelName: 'Resources', tableName: 'resources', freezeTableName: true, paranoid: true }
	)

	Resource.associate = (models) => {
		Resource.belongsTo(models.Session, {
			foreignKey: 'session_id',
			as: 'session',
			scope: {
				deleted_at: null,
			},
		})
	}

	return Resource
}
