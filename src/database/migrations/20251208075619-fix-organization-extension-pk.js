'use strict'

module.exports = {
	async up(queryInterface, Sequelize) {
		const table = 'organization_extension'

		//
		// 1. Ensure new columns exist (safety – avoids failures in older DBs)
		//
		const ensureColumn = async (column, type) => {
			const exists = await queryInterface.sequelize.query(
				`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = '${table}' AND column_name = '${column}'
        ) as exists;
        `,
				{ type: Sequelize.QueryTypes.SELECT }
			)

			if (!exists[0].exists) {
				await queryInterface.addColumn(table, column, { type, allowNull: true })
			}
		}

		await ensureColumn('organization_code', Sequelize.STRING)
		await ensureColumn('tenant_code', Sequelize.STRING)

		//
		// 2. Backfill NULL values (required before NOT NULL constraint)
		//
		await queryInterface.sequelize.query(
			`
      UPDATE ${table}
      SET organization_code = 'default_org'
      WHERE organization_code IS NULL;
      `
		)

		await queryInterface.sequelize.query(
			`
      UPDATE ${table}
      SET tenant_code = 'default_tenant'
      WHERE tenant_code IS NULL;
      `
		)

		//
		// 3. Apply NOT NULL constraints
		//
		await queryInterface.changeColumn(table, 'organization_code', {
			type: Sequelize.STRING,
			allowNull: false,
		})

		await queryInterface.changeColumn(table, 'tenant_code', {
			type: Sequelize.STRING,
			allowNull: false,
		})

		await queryInterface.changeColumn(table, 'organization_id', {
			type: Sequelize.STRING,
			allowNull: false,
		})

		//
		// 4. Drop existing primary key (if exists)
		//
		const pkNameQuery = await queryInterface.sequelize.query(
			`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name='${table}' AND constraint_type='PRIMARY KEY';
      `,
			{ type: Sequelize.QueryTypes.SELECT }
		)

		if (pkNameQuery.length > 0) {
			const pkName = pkNameQuery[0].constraint_name
			await queryInterface.sequelize.query(`ALTER TABLE ${table} DROP CONSTRAINT ${pkName};`)
		}

		//
		// 5. Add composite primary key
		//
		await queryInterface.sequelize.query(
			`
      ALTER TABLE ${table}
      ADD PRIMARY KEY (organization_id, organization_code, tenant_code);
      `
		)
	},

	async down(queryInterface, Sequelize) {
		const table = 'organization_extension'

		// Drop composite PK
		const pkNameQuery = await queryInterface.sequelize.query(
			`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name='${table}' AND constraint_type='PRIMARY KEY';
      `,
			{ type: Sequelize.QueryTypes.SELECT }
		)

		if (pkNameQuery.length > 0) {
			const pkName = pkNameQuery[0].constraint_name
			await queryInterface.sequelize.query(`ALTER TABLE ${table} DROP CONSTRAINT ${pkName};`)
		}

		// Restore old single-column PK (optional — depends on original schema)
		await queryInterface.sequelize.query(
			`
      ALTER TABLE ${table}
      ADD PRIMARY KEY (organization_id);
      `
		)
	},
}
