'use strict'
module.exports = (sequelize, DataTypes) => {
	const RequestSession = sequelize.define(
		'RequestSessionRequests',
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
			modelName: 'RequestSessionRequests',
			tableName: 'request_session_requests',
			freezeTableName: true,
			paranoid: true,
			indexes: [
				{
					fields: ['user_id', 'friend_id'],
					unique: true,
					name: 'unique_user_id_friend_id_request_session_requests',
					where: {
						deleted_at: null,
					},
				},
				{
					fields: ['friend_id'],
					name: 'index_friend_id_request_session_requests',
				},
				{
					fields: ['status'],
					name: 'index_status_request_session_requests',
				},
				{
					fields: ['created_by'],
					name: 'index_created_by_request_session_requests',
				},
				{
					fields: ['session_id'],
					name: 'index_session_id_request_session_requests',
				},
			],
		}
	)

	return RequestSession
}
