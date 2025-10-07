/**
 * name : configs
 * author : Aman Kumar Gupta
 * Date : 31-Sep-2021
 * Description : Contains connections of all configs
 */

const path = require('path')

global.PROJECT_ROOT_DIRECTORY = path.join(__dirname, '..')

require('./kafka')()

require('./cache')()

require('./bull')()
