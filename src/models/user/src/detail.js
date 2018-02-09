let Preferences = require('preferences')
const CONST = require('../../../libs/const')
let getSpmAPIToken = require('../libs/authentify').getSpmAPIToken

/* uses local preferences file to display user information without password */
module.exports = () => {
  return new Promise((resolve, reject) => {
    let prefs = new Preferences(CONST.PREFERENCES)
    if (!prefs.user) {
      Prompt([{
        name: 'authentify',
        type: 'confirm',
        message: 'no user detected, do you want to login ?'
      }])
      .then(answer => {
        if (answer.authentify) { getSpmAPIToken('login').then(resolve).catch(reject) } else { return resolve() }
      })
      .catch(reject)
    } else {
      let table = ['🔹', '🔸']
      let i = 0
      for (let key in prefs) {
        if (key !== 'token') {
          i++
          console.log(`${table[i % 2]}  ${key}: ${prefs[key]}`)
        }
      }
      return resolve()
    }
  })
}