'use strict'
module.exports = (sequelize, DataTypes) => {
	const SessionRequestMapping = sequelize.define(
		'SessionRequestMapping',
		{
			requestee_id: {
				type: DataTypes.STRING,
				allowNull: false,
				primaryKey: true,
			},
			request_session_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				primaryKey: true,
			},
		},
		{
			sequelize,
			modelName: 'SessionRequestMapping',
			tableName: 'session_request_mapping',
			freezeTableName: true,
			timestamps: false,
			indexes: [
				{
					fields: ['requestee_id'],
					name: 'index_requestee_id_session_request_mapping',
				},
			],
		}
	)

	return SessionRequestMapping
}
