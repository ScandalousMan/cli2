const Chalk = require('chalk')
const CONST = require('./const')

let errorFunc = (err) => {
  console.log(Chalk.hex(CONST.ERROR_COLOR)(err))
}

module.exports = {
	errorFunc
}