let Fs = require('fs')
let Path = require('path')
let Sass = require('node-sass')
let Prompt = require('inquirer').prompt
let Debug = require('../../../lib/debug')
let Common = require('../../../lib/common')
let CONST = require('../../../lib/const')

const SCSS_IGNORED_CHARS = [' ', '\n', '\t']

/* whitespaces cleaner for strings */
let removeWhitespaces = (str) => {
  if (str.length) {
    let i = 0
    while (str[i] === ' ') {
      i++
    }
    let j = str.length - 1
    while (str[j] === ' ') {
      j--
    }
    if (j !== 0) {
      return str.substring(i, j + 1)
    }
  }
  return str
}

/* removes comment and other neutral characters from css */
let cssCleaner = (str) => {
  if (!str || !str.length) { return str }
  let startIndex = 0
  let i, j
  while ((i = str.indexOf('/*', startIndex)) >= 0) {
    let j = str.indexOf('*/', i)
    if (j < 0) { return str }
    str = `${str.substring(0, i)}${str.substring(j + 2)}`
    startIndex = i + 1
  }
  i = 0
  while (i < str.length) {
    if (SCSS_IGNORED_CHARS.includes(str[i])) {
      j = 1
      while (SCSS_IGNORED_CHARS.includes(str[i + j])) { j++ }
      str = `${str.substring(0, i)} ${str.substring(i + j)}`
    }
    i++
  }
  return removeWhitespaces(str)
}

/* checks if a given selector has a valid scope included inside one of the publication's classes */
let parseSelector = (selector, classes, dependenciesMap) => {
  let item
  if (selector.indexOf(' ') >= 0) {
    let table = selector.split(' ')
    let i = 0
    if (i >= table.length) { return null } else { item = table[i] }
  } else { item = selector }
  let allClasses = classes.concat(Object.keys(dependenciesMap))
  for (let moduleClass of allClasses) {
    let i = item.indexOf('.' + moduleClass)
    if (i >= 0 &&
      ((i + moduleClass.length + 1 === item.length) || [' ', '\n', '\t', '.', '[', '{', '&', ':', ',', ';'].includes(item[i + moduleClass.length + 1]))) {
      return item
    }
  }
  return null
}

/* checks publication can't impact external elements with a larger-scoped selector */
let parseSelectors = (data, classes, dependenciesMap) => {
  let parsed = data.split(',')
  for (let selector of parsed) {
    selector = removeWhitespaces(selector)
    if (!selector.startsWith('@') && !parseSelector(selector, classes, dependenciesMap)) {
      return false
    }
  }
  return true
}

/* high level scope checker for css file */
let checkClass = (file, data, publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    data = cssCleaner(data)
    let startIndex = 0
    let i, j
    let tmpClasses = publish.json.classes.concat([publish.json.mainClass])
    while ((i = data.indexOf('@import', startIndex)) >= 0) { startIndex = data.indexOf(';', i) + 1 }
    while (startIndex >= 0 && (i = data.indexOf('@mixin', startIndex)) >= 0) {
      startIndex = data.indexOf('{', i) + 1
      let count = 0
      while (startIndex < data.length &&
        (data[startIndex] !== '}' || count > 0)) {
        if (data[startIndex] === '{') { count++ }
        if (data[startIndex] === '}') { count-- }
        startIndex++
      }
      startIndex++
    }
    while ((i = data.indexOf('{', startIndex)) >= 0) {
      j = data.indexOf('@media', startIndex)
      if (j < 0 || i < j) {
        if (!parseSelectors(data.substring(startIndex, i), tmpClasses, publish.dependenciesClassesMapping) && Common.cleanValue(data.substring(startIndex, i)) !== ':root') {
          // convert in css before making any check
          // return reject(new Error(`incorrect selector found : ${data.substring(startIndex, i)} in ${file}`))
        }
        i = data.indexOf('}', i)
      }
      startIndex = i + 1
    }
    return resolve(publish)
  })
}

/* Information parser from @import tags */
let importToFile = (data) => {
  if (data.length > 2) {
    if (data.startsWith("'") &&
      data.split("'").length === 3 &&
      data.split("'")[0] === '') {
      return data.split("'")[1]
    }
    if (data.startsWith('"') &&
      data.split('"').length === 3 &&
      data.split('"')[0] === '') {
      return data.split('"')[1]
    }
    if (data.startsWith('url(') && data.indexOf(')') > 5) {
      return importToFile(data.substring(4, data.indexOf(')')))
    }
  }
  return null
}

/* Checks all import found from the entry file are included in the project */
let recursiveCheckModule = (filePath, publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    if (Path.relative(publish.path, filePath).startsWith('..')) { return reject(new Error(`imported file ${filePath} out of module's scope`)) }
    Fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) { return reject(err) }
      publish.ressources.push(filePath)
      checkClass(filePath, data, publish)
      .then(() => {
        let dataAt = data.split('@import ')
        let dataAtClose = []
        for (let elem of dataAt) {
          if (elem.indexOf(';') >= 0) {
            let resultFile = importToFile(elem.split(';')[0])
            if (resultFile && !resultFile.startsWith('http')) {
              dataAtClose.push(resultFile)
            }
          }
        }
        let promises = []
        for (let module of dataAtClose) {
          promises.push(recursiveCheckModule(`${filePath.substring(0, filePath.lastIndexOf('/'))}/${module}`, publish))
        }
        Promise.all(promises)
        .then(() => { return resolve(publish) })
        .catch(reject)
      })
      .catch(reject)
    })
  })
}

/* Convert the project to css if needed in order to check selectors' scope */
let scssToCssForCheck = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    if (publish.style === 'scss') {
      Fs.writeFile(`${publish.path}/.tmp_spm/.sass_spm/style.scss`, `@import '../tmp/${publish.json.files.style}';`, err => {
        if (err) { return reject(err) }
        Sass.render({
          file: `${publish.path}/.tmp_spm/.sass_spm/style.scss`,
          outFile: `${publish.path}/.tmp_spm/.sass_spm/result.css`
        }, function (error, result) {
          if (!error) {
            Fs.writeFile(`${publish.path}/.tmp_spm/.sass_spm/result.css`, result.css, function (err) {
              if (!err) {
                checkClass(`${publish.path}/.tmp_spm/.sass_spm/result.css`, result.css, publish)
                .then(() => { return resolve(publish) })
                .catch(reject)
              } else { return reject(new Error('error while converting scss file to css')) }
            })
          } else { return reject(error.message) } // node-sass error message
        })
      })
    } else { return resolve(publish) }
  })
}

/* To confirm the deletion of declared and unused dependencies */
let confirmDependancyRemoval = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    if (Object.keys(publish.removed).length && !publish.force) {
      let questions = [
        {
          type: 'checkbox',
          name: 'keeping',
          message: 'spm has detected the following unused dependancies - which one do you want to keep ?\n',
          choices: Object.keys(publish.removed)
        }
      ]
      Prompt(questions)
      .then(answer => {
        let removed = {}
        for (let item in publish.removed) {
          if (!(answer.keeping).includes(item)) {
            removed[item] = publish.dependencies[item]
            delete publish.dependencies[item]
          }
        }
        publish.removed = removed
        return resolve(publish)
      })
      .catch(reject)
    } else {
      return resolve(publish)
    }
  })
}

/* Some dependency can be declared and not used */
let unusedDependencies = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    let dependencies = Object.assign({}, publish.dependencies)
    let removed = {}
    for (let dependency in dependencies) {
      let flag = false
      for (let ressource of publish.ressources) {
        if (Path.relative(`${publish.path}/spm_modules/${dependency}`, ressource.substring(0, ressource.lastIndexOf('/'))) === '') {
          flag = true
          break
        }
      }
      if (!flag) {
        publish.warnings.push(`dependency ${dependency} is not used`)
        removed[dependency] = dependencies[dependency]
      }
    }
    publish.removed = removed
    confirmDependancyRemoval(publish)
    .then(resolve)
    .catch(reject)
  })
}

/* removes the files creted for scss check */
let clearspmModulesTmpPromise = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    Common.deleteFolderRecursivePromise(`${publish.path}/.tmp_spm/.sass_spm`, true)
    .then(() => { return resolve(publish) })
    .catch(reject)
  })
}

/* css checker */
let fileCheckerPromise = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    publish.ressources = []
    recursiveCheckModule(`${publish.path}/${publish.json.files.style}`, publish)
    .then(scssToCssForCheck)
    .then(unusedDependencies)
    .then(clearspmModulesTmpPromise)
    .then(resolve)
    .catch(reject)
  })
}

/* after installation, default values initialized for potential instances */
let defineParametersOrderPromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    try {
      Fs.readFile(`${install.target}/${install.files.style}`, 'utf8', (err, data) => {
        if (err && err !== 'ENOENT') { return reject(err) } else if (err) { return reject(new Error(`incorrect entry file in module ${install.name}@${install.version}`)) }
        let i = data.indexOf(`@mixin ${install.jsonFile.mainClass}(`)
        i = i + `@mixin ${install.jsonFile.mainClass}(`.length
        let j = data.indexOf(')', i)
        let k
        install.ssParameters = []
        install.ssDefaultMapping = {}
        for (let moduleClass of install.jsonFile.classes) {
          for (let classVariable of moduleClass.variables) {
            install.ssDefaultMapping[classVariable.name] = classVariable.value
          }
        }
        while ((k = data.indexOf(',', i)) >= 0 && k < j) {
          if (data.substring(i, k).startsWith('$_') && !data.substring(i, k).startsWith('$_local-')) {
            install.ssParameters.push(data.substring(i + 2, k))
          }
          i = k + 1
        }
        return resolve(install)
      })
    } catch (err) {
      return reject(err)
    }
  })
}

/*  */
let processInstancesPromise = (install) => {
  return new Promise((resolve, reject) => {
    Fs.readFile(`${install.pathFinal}/${CONST.INSTANCE_FOLDER}/${CONST.INSTANCE_FOLDER}.scss`, 'utf8', (err, data) => {
      if (err && err.code !== 'ENOENT') { return reject(err) } else if (err) {
        // create the file from scratch
        let importData = ''
        let includeData = ''
        for (let module of install.children) { // finalInstances
          module.variableMap = {}
          module.classParameters = []
          for (let moduleClass of module.jsonFile.classes) {
            module.classParameters.push(moduleClass.name)
            for (let variableItem of moduleClass.variables) { module.variableMap[variableItem.name] = variableItem.value }
          }
          let ssParameters = ''
          let classParameters = ''
          for (let param of module.ssParameters) { ssParameters += `${module.variableMap[param]},` }
          for (let moduleClass of module.classParameters) { classParameters += `'${moduleClass}',` }
          classParameters = classParameters.slice(0, -1)
          importData += `@import '../spm_modules/${module.name}/${module.files.style}';\n`
          includeData += `@include ${module.name}(${ssParameters}${classParameters});\n`
        }
        data = `${importData}\n${includeData}`
      } else {
        // add in folder the correct instances
      }
      Fs.writeFile(`${install.pathFinal}/${CONST.INSTANCE_FOLDER}/${CONST.INSTANCE_FOLDER}.scss`, data, err => {
        if (err) { return reject(err) }
        if (install.debug) { console.log('>> (css) updating', `${install.pathFinal}/${CONST.INSTANCE_FOLDER}/${CONST.INSTANCE_FOLDER}.scss`) }
        return resolve(install)
      })
    })
  })
}

/* turns a scss file into a css file and removes scss files + map */
let convertScssToCss = (input, output) => {
  return new Promise((resolve, reject) => {
    Sass.render({
      file: input,
      outFile: output
    }, function (err, result) {
      if (err) { return reject(err) }
      Fs.writeFile(output, result.css, err => {
        if (err) { return reject(err) }
        return resolve(output)
      })
    })
  })
}

/* creates or updates the adequate scss instance file plus generates the css if needed */
let generateInstancePromise = (generate) => {
  if (generate.debug) { Debug() }
  return new Promise((resolve, reject) => {
    Fs.readFile(`${generate.pathModules}/${generate.moduleName}/${generate.jsonFile.files.style}`, 'utf8', (err, data) => {
      try {
        if (err) { return reject(err) }
        let parameters = ''
        let i = data.indexOf('@mixin spm-')
        i = data.indexOf('(', i)
        let j = data.indexOf(')', i)
        for (let parameter of data.substring(i + 1, j).split(',')) {
          parameter = Common.removeWhitespaces(parameter)
          if (parameter.startsWith('$local-')) {
            if (!generate.variablesMap[parameter.substring(7)]) { generate.variablesMap[parameter.substring(7)] = `$_${parameter.substring(7)}` }
            parameters += `${generate.variablesMap[parameter.substring(7)].to || generate.variablesMap[parameter.substring(7)].from},`
          } else if (parameter.startsWith('$mixin-local-')) {
            parameters += `'${generate.nicknames[parameter.substring(13)]}',`
          } else {
            return reject(new Error(`wrong parameter ${parameter} in module entry point file`))
          }
        }
        if (parameters.endsWith(',')) { parameters = parameters.slice(0, -1) }

        Fs.readFile(`${generate.pathFinal}/${CONST.INSTANCE_FOLDER}/${CONST.INSTANCE_FOLDER}.scss`, 'utf8', (err, data) => {
          if (err && err.code !== 'ENOENT') { return reject(err) } else if (err) {
            data = `@import "../variables-spm.scss";\n@import "../${generate.jsonFile.files.style}";\n\n`
          } else {

          }
          data += `@include spm-${generate.jsonFile.main}-class(${parameters});\n`
          Fs.writeFile(`${generate.pathModules}/${generate.moduleName}/dist/${generate.nickname}.scss`, data, err => {
            if (err) { return reject(err) }
            if (generate.style === 'css') {
              Common.convertScssToCss(generate, `${generate.pathModules}/${generate.moduleName}/dist/`, generate.nickname)
              .then(res => {
                generate.successes.push(`instance ${generate.nickname}.css of module ${generate.moduleName} has been generated`)
                return resolve(generate)
              })
              .catch(reject)
            } else {
              generate.successes.push(`instance ${generate.nickname}.scss of module ${generate.moduleName} has been generated`)
              return resolve(generate)
            }
          })
        })
      } catch (err) { return reject(err) }
    })
  })
}

module.exports = {
  fileCheckerPromise,
  defineParametersOrderPromise,
  processInstancesPromise,
  convertScssToCss,
  generateInstancePromise
}
