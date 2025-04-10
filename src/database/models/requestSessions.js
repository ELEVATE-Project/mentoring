'use strict'
module.exports = (sequelize, DataTypes) => {
	const RequestSession = sequelize.define(
		'RequestSession',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			user_id: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			friend_id: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			status: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			meta: {
				type: DataTypes.JSON,
			},
			agend: {
				type: DataTypes.STRING,
			},
			start_date: {
				type: DataTypes.INTEGER,
			},
			end_date: {
				type: DataTypes.INTEGER,
			},
			session_id: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			updated_by: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			created_by: {
				type: DataTypes.STRING,
				allowNull: false,
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
			deleted_at: {
				type: DataTypes.DATE,
			},
		},
		{
			sequelize,
			modelName: 'RequestSession',
			tableName: 'request_sessions',
			freezeTableName: true,
			paranoid: true,
			indexes: [
				{
					fields: ['user_id', 'friend_id'],
					unique: true,
					name: 'unique_user_id_friend_id_request_sessions',
					where: {
						deleted_at: null,
					},
				},
				{
					fields: ['friend_id'],
					name: 'index_friend_id_request_sessions',
				},
				{
					fields: ['status'],
					name: 'index_status_request_sessions',
				},
				{
					fields: ['created_by'],
					name: 'index_created_by_request_sessions',
				},
				{
					fields: ['session_id'],
					name: 'index_session_id_request_sessions',
				},
			],
		}
	)

	return RequestSession
}
