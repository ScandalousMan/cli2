const Chalk = require('chalk')
let Preferences = require('preferences')
const CONST = require('../../../libs/const')

/* logouts the user from preferences and clean its information */
module.exports = () => {
  return new Promise((resolve, reject) => {
    let prefs = new Preferences(CONST.PREFERENCES)
    if (!prefs || !Object.keys(prefs).length) {
      console.log(Chalk.hex(CONST.WARNING_COLOR)('you are already disconnected'))
      return resolve()
    } else {
      for (let key in prefs) { delete prefs[key] }
      console.log('user disconnected - come again soon 👻')
      return resolve()
    }
  })
}