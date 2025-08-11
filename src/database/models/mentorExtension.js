'use strict'
const Sequelize = require('sequelize')
const Op = Sequelize.Op
module.exports = (sequelize, DataTypes) => {
	const MentorExtension = sequelize.define(
		'MentorExtension',
		{
			user_id: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.STRING,
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
			mentor_visibility: {
				type: DataTypes.STRING,
			},
			visible_to_organizations: {
				type: DataTypes.ARRAY(DataTypes.STRING),
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
			organization_id: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			external_mentee_visibility: {
				type: DataTypes.STRING,
				defaultValue: 'CURRENT',
			},
			mentee_visibility: {
				type: DataTypes.STRING,
				defaultValue: 'CURRENT',
			},
			name: {
				type: DataTypes.STRING,
			},
			email: {
				type: DataTypes.STRING,
			},
			phone: {
				type: DataTypes.STRING,
			},
		},
		{
			sequelize,
			modelName: 'MentorExtension',
			tableName: 'mentor_extensions',
			freezeTableName: true,
			paranoid: true,
			defaultScope: {
				attributes: { exclude: ['name', 'email'] },
			},
		}
	)
	return MentorExtension
}
