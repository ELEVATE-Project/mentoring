const orgAdminService = require('@services/org-admin')
const common = require('@constants/common')

module.exports = class OrgAdmin {
	/**
	 * setOrgPolicies
	 * @method
	 * @name setOrgPolicies
	 * @param {Object} req - Request data.
	 * @param {Object} req.body - Request body containing updated policies.
	 * @param {String} req.body.session_visibility_policy - Session visibility policy.
	 * @param {String} req.body.mentor_visibility_policy - Mentor visibility policy.
	 * @param {String} req.body.external_session_visibility_policy - External session visibility policy.
	 * @param {String} req.body.external_mentor_visibility_policy - External mentor visibility policy.
	 * @param {String} req.body.external_mentee_visibility_policy - External mentee visibility policy.
	 * @param {String} req.body.mentee_visibility_policy - mentee visibility policy.
	 * @param {Array} req.body.is_approval_required - List of approvals required (Irrelevant for now).
	 * @param {Boolean} req.body.allow_mentor_override - Allow mentor override flag.
	 * @returns {JSON} - Success Response.
	 * @throws {Error} - Returns an error if the update fails.
	 */

	async setOrgPolicies(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const orgPolicies = await orgAdminService.setOrgPolicies(req.decodedToken, req.body, tenantCode)
			return orgPolicies
		} catch (error) {
			return error
		}
	}

	async getOrgPolicies(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			//req.decodedToken.organization_code
			const orgPolicies = await orgAdminService.getOrgPolicies(req.decodedToken, tenantCode)
			return orgPolicies
		} catch (error) {
			return error
		}
	}

	/**
	 * @description			- change user role.
	 * @method				- post
	 * @name 				- roleChange
	 * @returns {JSON} 		- user role change details.
	 */

	async roleChange(req) {
		try {
			const tenantCode = req.body.tenant_code

			let changedRoleDetails = await orgAdminService.roleChange(req.body, {}, req.decodedToken, tenantCode)
			return changedRoleDetails
		} catch (error) {
			return error
		}
	}

	/**
	 * @description			- Inherit entity type.
	 * @method				- post
	 * @name 				- inheritEntityType
	 * @returns {JSON} 		- Inherited entity type details.
	 */

	async inheritEntityType(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			let entityTypeDetails = await orgAdminService.inheritEntityType(
				req.body.entity_type_value,
				req.body.target_entity_type_label,
				req.decodedToken.organization_code,
				req.decodedToken,
				tenantCode
			)
			return entityTypeDetails
		} catch (error) {
			return error
		}
	}

	/**
	 * updateOrganization
	 * @method
	 * @name updateOrganization
	 * @param {Object} req - Request data.
	 * @param {Object} req.body - Request body containing updated policies.
	 * @param {String} req.body.user_id - User id.
	 * @param {String} req.body.organization_code - Organization code.
	 * @param {Array} req.body.roles - User Roles.
	 * @returns {JSON} - Success Response.
	 * @throws {Error} - Returns an error if the update fails.
	 */
	async updateOrganization(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const updateOrg = await orgAdminService.updateOrganization(req.body, tenantCode)
			return updateOrg
		} catch (error) {
			return error
		}
	}

	/**
	 * deactivateUpcomingSession
	 * @method
	 * @name deactivateUpcomingSession
	 * @param {Object} req - Request data.
	 * @param {String} req.body.user_ids - User ids.
	 * @returns {JSON} - Success Response.
	 * @throws {Error} - Returns an error if the update fails.
	 */
	async deactivateUpcomingSession(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const response = await orgAdminService.deactivateUpcomingSession(
				req.body.user_ids,
				req.decodedToken,
				tenantCode
			)
			return response
		} catch (error) {
			return error
		}
	}

	/**
	 * updateRelatedOrgs
	 * @method
	 * @name updateRelatedOrgs
	 * @param {Array} req.body.related_organization_codes - Related orgs codes.
	 * @param {String} req.body.organization_code - Code of the organisation .
	 * @returns {JSON} - Success Response.
	 * @throws {Error} - Error response.
	 */
	async updateRelatedOrgs(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			return await orgAdminService.updateRelatedOrgs(
				req.body.delta_organization_ids,
				req.body.organization_id,
				req.body.action,
				tenantCode
			)
		} catch (error) {
			return error
		}
	}

	async setDefaultQuestionSets(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			return await orgAdminService.setDefaultQuestionSets(req.body, req.decodedToken, tenantCode)
		} catch (error) {
			return error
		}
	}

	/**
	 * Upload sample csv based on org id
	 * @method
	 * @name UploadSampleCsv
	 * @param {String} req.body.file_path -Uploaded filr path .
	 * @returns {Object} - uploaded file response.
	 */

	async uploadSampleCSV(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const userId = req.decodedToken.id

			const updatePath = await orgAdminService.uploadSampleCSV(
				req.body.file_path,
				req.decodedToken.organization_code,
				tenantCode
			)
			return updatePath
		} catch (error) {
			return error
		}
	}

	/**
	 * Update theme for the organization based on the provided theme data.
	 * @method
	 * @name updateTheme
	 * @param {Object} req.body - The theme data to be updated.
	 * @param {String} req.decodedToken.organization_code - The organization ID extracted from the decoded token.
	 * @returns {Object} - The result of the theme update, either success or error details.
	 */
	async updateTheme(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const updateTheme = await orgAdminService.updateTheme(req.body, organizationCode, tenantCode)
			return updateTheme
		} catch (error) {
			return error
		}
	}

	/**
	 * Get the theme details for the organization based on the provided theme data.
	 * @method
	 * @name themeDetails
	 * @param {Object} req.body - The theme data to be updated.
	 * @param {String} req.decodedToken.organization_code - The organization ID extracted from the decoded token.
	 * @returns {Object} - The result of the theme update, either success or error details.
	 */
	async themeDetails(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const themeDetails = await orgAdminService.themeDetails(
				req.query.organizationCode ? req.query.organizationCode : req.decodedToken.organization_code,
				tenantCode
			)
			return themeDetails
		} catch (error) {
			return error
		}
	}
}
