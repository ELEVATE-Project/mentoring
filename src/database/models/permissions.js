module.exports = (sequelize, DataTypes) => {
	const Permissions = sequelize.define(
		'permissions',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			code: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			module: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			actions: {
				allowNull: false,
				type: DataTypes.ENUM('ALL', 'READ', 'WRITE', 'UPDATE', 'DELETE'),
			},
			status: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: 'ACTIVE',
			},
		},
		{
			timestamps: false,
		},
		{
			sequelize,
			modelName: 'Permissions',
			tableName: 'permissions',
			freezeTableName: true,
			indexes: [{ unique: true, fields: ['code'] }],
		}
	)

	return Permissions
}
