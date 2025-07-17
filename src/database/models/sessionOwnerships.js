module.exports = (sequelize, DataTypes) => {
	const SessionOwnership = sequelize.define(
		'SessionOwnership',
		{
			id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				autoIncrement: true,
			},
			user_id: {
				type: DataTypes.STRING,
				allowNull: false,
				primaryKey: true,
			},
			session_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				primaryKey: true,
			},
			type: {
				type: DataTypes.STRING,
				allowNull: false,
				primaryKey: true,
				validate: {
					isIn: [['MENTOR', 'CREATOR']],
				},
			},
			organization_code: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			tenant_code: {
				type: DataTypes.STRING,
				allowNull: true,
			},
		},
		{
			sequelize,
			modelName: 'SessionOwnership',
			tableName: 'session_ownerships',
			freezeTableName: true,
			paranoid: true,
		}
	)

	return SessionOwnership
}
