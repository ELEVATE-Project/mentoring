'use strict'

module.exports = {
    async up(queryInterface, Sequelize) {
        // Update fields to NULL where deleted_at is not NULL
        await queryInterface.sequelize.query(`
      UPDATE "user_extensions"
      SET 
        "custom_entity_text" = NULL,
        "name" = NULL,
        "email" = NULL,
        "phone" = NULL,
      WHERE "deleted_at" IS NOT NULL;
    `)
    },

    async down(queryInterface, Sequelize) {
        // Reverting this update is unnecessary as it's a corrective action
    },
}
