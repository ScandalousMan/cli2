const Chalk = require('chalk')
const CONST = require('./const')

let errorFunc = (err) => {
  console.log(Chalk.hex(CONST.ERROR_COLOR)(err))
  if (CONST.DEBUG) { console.log(err.stack) }
}

module.exports = {
  errorFunc
}
