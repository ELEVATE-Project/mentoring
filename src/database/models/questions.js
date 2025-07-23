module.exports = (sequelize, DataTypes) => {
	const Question = sequelize.define(
		'Question',
		{
			id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				primaryKey: true,
				autoIncrement: true,
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			question: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			options: {
				type: DataTypes.ARRAY(DataTypes.STRING),
				allowNull: true,
			},
			type: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			no_of_stars: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			status: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: 'PUBLISHED',
			},
			category: {
				type: DataTypes.JSON,
				allowNull: true,
			},
			rendering_data: {
				type: DataTypes.JSON,
				allowNull: true,
			},
			meta: {
				type: DataTypes.JSON,
				allowNull: true,
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
				defaultValue: 'DEFAULT_ORG',
			},
			tenant_code: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: 'DEFAULT_TENANT',
			},
		},
		{ sequelize, modelName: 'Question', tableName: 'questions', freezeTableName: true, paranoid: true }
	)

	return Question
}
