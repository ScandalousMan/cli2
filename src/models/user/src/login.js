let getSpmAPIToken = require('../libs/authentify').getSpmAPIToken

/* uses getSpmAPIToken to login a user and save it in preferences */
module.exports = (force = false) => {
  return new Promise((resolve, reject) => {
    getSpmAPIToken('login', force)
    .then(resolve)
    .catch(reject)
  })
}