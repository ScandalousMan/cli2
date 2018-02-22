let Fs = require('fs')
let Acorn = require('acorn')
let Debug = require('../../../lib/debug')
let CONST = require('../../../lib/const')

/* using acorn to check if the script contains instructions and is correct */
let parseProcessPromise = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    let table = Acorn.parse(publish.jsData)
    if (!table.body.length) { return reject(new Error(`missing script in ${publish.json.files.script}`)) }
    for (let item of table.body) {
      if (item.type === 'VariableDeclaration') {
        for (let declaration of item.declarations) {
          if (declaration.id.name.startsWith(CONST.INSTANCE_PREFIX) && declaration.init === null) {
            return reject(new Error(`ERROR ${declaration.id.name} type instance const not assigned`))
          }
        }
      } else if (item.type === 'ExpressionStatement' && item.expression.type === 'AssignmentExpression' && item.expression.left.name.startsWith(CONST.INSTANCE_PREFIX)) {
        return reject(new Error(`ERROR ${item.expression.left.name} type instance const assigned out of declaration`))
      }
    }
    return resolve(publish)
  })
}

/* drives the js checking logic */
let fileCheckerPromise = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    Fs.readFile(`${publish.path}/${publish.json.files.script}`, 'utf8', (err, data) => {
      if (err) { return reject(err) }
      publish.jsData = data
      parseProcessPromise(publish)
      .then(resolve)
      .catch(reject)
    })
  })
}

module.exports = {
  fileCheckerPromise
}
