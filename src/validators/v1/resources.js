/**
 * name : validators/v1/resources.js
 * author : Rakesh
 * Date : 13-May-2025
 * Description : Validations of user entities controller
 */

module.exports = {
	delete: (req) => {
		req.checkParams('id').notEmpty().withMessage('id param is empty')
		req.checkQuery('sessionId').notEmpty().withMessage('sessionId is required in query params')
	},
}
