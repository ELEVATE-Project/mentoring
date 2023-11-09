'use strict'
module.exports = (sequelize, DataTypes) => {
	const UserExtension = sequelize.define(
		'UserExtension',
		{
			user_id: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			status: {
				type: DataTypes.STRING,
				defaultValue: 'ACTIVE',
			},
			designation: {
				type: DataTypes.ARRAY(DataTypes.STRING),
			},
			area_of_expertise: {
				type: DataTypes.ARRAY(DataTypes.STRING),
			},
			education_qualification: {
				type: DataTypes.STRING,
			},
			rating: {
				type: DataTypes.JSON,
			},
			meta: {
				type: DataTypes.JSONB,
			},
			stats: {
				type: DataTypes.JSONB,
			},
			tags: {
				type: DataTypes.ARRAY(DataTypes.STRING),
			},
			configs: {
				type: DataTypes.JSON,
			},
			visibility: {
				type: DataTypes.STRING,
			},
			organisation_ids: {
				type: DataTypes.ARRAY(DataTypes.INTEGER),
			},
			external_session_visibility: {
				type: DataTypes.STRING,
			},
			external_mentor_visibility: {
				type: DataTypes.STRING,
			},
			custom_entity_text: {
				type: DataTypes.JSON,
			},
			experience: {
				type: DataTypes.STRING,
			},
		},
		{
			sequelize,
			modelName: 'UserExtension',
			tableName: 'user_extensions',
			freezeTableName: true,
			paranoid: true,
		}
	)
	return UserExtension
}
