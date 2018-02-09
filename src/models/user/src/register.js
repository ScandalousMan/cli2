let getSpmAPIToken = require('../libs/authentify').getSpmAPIToken

/* uses getSpmAPIToken to register a user and save it in preferences */
let register = (force = true) => {
  return new Promise((resolve, reject) => {
    getSpmAPIToken('register', force)
    .then(resolve)
    .catch(reject)
  })
}