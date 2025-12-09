const userRequests = require('@requests/user')
const common = require('@constants/common')
const entityTypeQueries = require('@database/queries/entityType')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const { Op } = require('sequelize')

module.exports = class OrganizationAndEntityTypePolicyHelper {
	static async getOrganizationIdBasedOnPolicy(userId, organization_id, filterType) {
		try {
			let organizationIds = []
			filterType = filterType.toLowerCase()

			let visibilityPolicies = []
			let orgVisibilityPolicies = []

			const policyMap = {
				[common.MENTEE_ROLE]: ['organization_id', 'external_mentee_visibility_policy'],
				[common.SESSION]: ['organization_id', 'external_session_visibility_policy'],
				[common.MENTOR_ROLE]: ['organization_id', 'external_mentor_visibility_policy'],
			}
			visibilityPolicies = policyMap[filterType] || []
			const attributes = visibilityPolicies

			const orgExtension = await organisationExtensionQueries.findOne(
				{ organization_id },
				{
					attributes: attributes,
				}
			)

			const orgPolicyMap = {
				[common.MENTEE_ROLE]: orgExtension.external_mentee_visibility_policy,
				[common.SESSION]: orgExtension.external_session_visibility_policy,
				[common.MENTOR_ROLE]: orgExtension.external_mentor_visibility_policy,
			}
			orgVisibilityPolicies = orgPolicyMap[filterType] || []
			const visibilityPolicy = orgVisibilityPolicies

			if (orgExtension?.organization_id) {
				if (visibilityPolicy === common.CURRENT) {
					organizationIds.push(orgExtension.organization_id)
				} else if (visibilityPolicy === common.ASSOCIATED || visibilityPolicy === common.ALL) {
					organizationIds.push(orgExtension.organization_id)
					let relatedOrgs = []
					let userOrgDetails = await userRequests.fetchOrgDetails({
						organizationId: orgExtension.organization_id,
					})
					if (userOrgDetails.success && userOrgDetails.data?.result?.related_orgs?.length > 0) {
						relatedOrgs = userOrgDetails.data.result.related_orgs
					}
					if (visibilityPolicy === common.ASSOCIATED) {
						const associatedAdditionalFilter =
							filterType == common.MENTEE_ROLE
								? {
										mentee_visibility_policy: {
											[Op.ne]: 'CURRENT',
										},
								  }
								: filterType == common.SESSION
								? {
										session_visibility_policy: {
											[Op.ne]: 'CURRENT',
										},
								  }
								: {
										mentor_visibility_policy: {
											[Op.ne]: 'CURRENT',
										},
								  }

						const organizationExtension = await organisationExtensionQueries.findAll(
							{
								[Op.and]: [
									{
										organization_id: {
											[Op.in]: [...relatedOrgs],
										},
									},
									associatedAdditionalFilter,
								],
							},
							{
								attributes: ['organization_id'],
							}
						)
						organizationIds.push(orgExtension.organization_id)
						if (organizationExtension) {
							const organizationIdsFromOrgExtension = organizationExtension.map(
								(orgExt) => orgExt.organization_id
							)
							organizationIds.push(...organizationIdsFromOrgExtension)
						}
					} else {
						// filter out the organizations
						// CASE 1 : in case of mentee listing filterout organizations with external_mentee_visibility_policy = ALL
						// CASE 2 : in case of session listing filterout organizations with session_visibility_policy = ALL
						// CASE 3 : in case of mentor listing filterout organizations with mentor_visibility_policy = ALL
						const filterQuery =
							filterType == common.MENTEE_ROLE
								? {
										mentee_visibility_policy: common.ALL, //1
								  }
								: filterType == common.SESSION
								? {
										session_visibility_policy: common.ALL, //2
								  }
								: {
										mentor_visibility_policy: common.ALL, //3
								  }

						// this filter is applied for the below condition
						// SM mentee_visibility_policy (in case of mentee list) or external_mentor_visibility policy (in case of mentor list) = ALL
						//  and CASE 1 (mentee list) : Mentees is related to the SM org but external_mentee_visibility is CURRENT (exclude these mentees)
						//  CASE 2 : (session list) : Sessions is related to the SM org but session_visibility is CURRENT (exclude these sessions)
						//  CASE 3 : (mentor list) : Mentors is related to SM Org but mentor_visibility set to CURRENT  (exclude these mentors)
						const additionalFilter =
							filterType == common.MENTEE_ROLE
								? {
										mentee_visibility_policy: {
											//1
											[Op.ne]: 'CURRENT',
										},
								  }
								: filterType == common.SESSION
								? {
										session_visibility_policy: {
											//2
											[Op.ne]: 'CURRENT',
										},
								  }
								: {
										mentor_visibility_policy: {
											//3
											[Op.ne]: 'CURRENT',
										},
								  }
						const organizationExtension = await organisationExtensionQueries.findAll(
							{
								[Op.or]: [
									filterQuery,
									{
										[Op.and]: [
											{
												organization_id: {
													[Op.in]: [...relatedOrgs],
												},
											},
											additionalFilter,
										],
									},
								],
							},
							{
								attributes: ['organization_id'],
							}
						)
						organizationIds.push(orgExtension.organization_id)
						if (organizationExtension) {
							const organizationIdsFromOrgExtension = organizationExtension.map(
								(orgExt) => orgExt.organization_id
							)
							organizationIds.push(...organizationIdsFromOrgExtension)
						}
					}
				}
			}

			return {
				success: true,
				result: organizationIds,
			}
		} catch (error) {
			return {
				success: false,
				message: error.message,
			}
		}
	}

	static async getEntityTypeWithEntitiesBasedOnOrg(
		organization_ids,
		entity_types,
		defaultOrgId = '',
		modelName,
		filter = {}
	) {
		try {
			filter.status = common.ACTIVE_STATUS
			filter.allow_filtering = true
			filter.has_entities = true
			filter.organization_id = {
				[Op.in]: defaultOrgId ? [...organization_ids, defaultOrgId] : organization_ids,
			}
			let entityTypes = []
			if (entity_types) {
				entityTypes = entity_types.split(',')
				filter.value = {
					[Op.in]: entityTypes,
				}
			}
			if (modelName) {
				filter.model_names = { [Op.contains]: [modelName] }
			}
			//fetch entity types and entities
			let entityTypesWithEntities = await entityTypeQueries.findUserEntityTypesAndEntities(filter)

			return {
				success: true,
				result: entityTypesWithEntities,
			}
		} catch (error) {
			return {
				success: false,
				message: error.message,
			}
		}
	}
}
