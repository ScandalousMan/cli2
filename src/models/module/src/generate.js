let Fs = require('fs')
let Prompt = require('inquirer').prompt
let Js = require('../lib/js')
let Css = require('../lib/css')
let Html = require('../lib/html')
let Debug = require('../../../lib/debug')
let Common = require('../../../lib/common')
let CONST = require('../../../lib/const')

/* checks for project and module context */
let defineGeneratePathsPromise = (generate) => {
  if (generate.debug) { Debug() }
  return new Promise((resolve, reject) => {
    generate.pathInitial = Common.getCurrentPath()
    Common.findProjectJsonPromise(generate.pathInitial)
    .then(path => {
      generate.pathProject = path
      Common.findModuleJsonPromise(generate.pathInitial)
      .then(path => {
        generate.pathModule = path
        generate.pathFinal = generate.pathModule || generate.pathProject || generate.pathInitial
        generate.pathModules = `${generate.pathFinal}/spm_modules`
        if (!generate.pathProject && !generate.pathModule) {
          generate.warnings.push('no module or project detected - generate in current path')
          Common.findModulesPromise(generate.pathInitial)
          .then(path => {
            generate.pathModules = path
            if (!path) { return reject(new Error(`no installed module - no instance to generate`)) }
            return resolve(generate)
          })
        } else {
          generate.initialPackage = `${generate.pathFinal}/${generate.pathModule ? CONST.MODULE_JSON_NAME : CONST.PROJECT_JSON_NAME}`
          return resolve(generate)
        }
      })
      .catch(reject)
    })
    .catch(reject)
  })
}

/* parses the project's jsonFile */
let parsePackagePromise = (generate) => {
  if (generate.debug) { Debug() }
  return new Promise((resolve, reject) => {
    if (!generate.pathPackage) { return resolve(generate) }
    Common.getJsonFilePromise(generate.pathPackage)
    .then(res => {
      if (!res) {
        generate.warnings.push(`instance not saved - missing package-spm.json - use spm init`)
      } else {
        generate.jsonFile = res
        if (res.style === 'scss') {
          generate.style = 'scss'
          generate.warnings.push(`default style has been set as scss`)
        }
        generate.jsStandard = res.jsStandard
        generate.warnings.push(`default js standard has been set as ${res.jsStandard}`)
      }
      return resolve(generate)
    })
    .catch(reject)
  })
}

/* generic function for list prompter */
let promptChoiceInListPromise = (list, message, index = 0) => {
  return new Promise((resolve, reject) => {
    if (!list || !list.length) { return reject(new Error('incorrect list')) }
    let questions = [{
      name: 'res',
      type: 'list',
      message,
      choices: list,
      default: list[index]
    }]
    Prompt(questions)
    .then(answer => {
      return resolve(answer.res)
    })
    .catch(reject)
  })
}

/* To define the targeted module(s) */
let selectModulePromise = (generate) => {
  if (generate.debug) { Debug() }
  return new Promise((resolve, reject) => {
    Fs.readdir(`${generate.pathModules}`, (err, files) => {
      if (err) { return reject(err) }
      Common.updateRegistryModulesPromise(generate)
      .then(() => {
        if (!generate.moduleChoices.length) { return reject(new Error('no module found in your project')) }
        if (generate.name) {
          if (!generate.moduleChoices.includes(generate.name)) {
            return reject(new Error(`module ${generate.name} not found, please install it with "spm install ${generate.name}"`))
          } else {
            generate.moduleName = generate.name
            if (generate.assign === Common.firstLetterUpperCase(generate.name)) { return reject(new Error(`variable ${generate.assign} already assigned as module Class declaration`)) }
            return resolve(generate)
          }
        } else {
          promptChoiceInListPromise(generate.moduleChoices, 'select the targeted module')
          .then(res => {
            generate.moduleName = res
            if (generate.assign === res) { return reject(new Error(`variable ${generate.assign} already assigned as module Class declaration`)) }
            Common.getJsonFilePromise(`${generate.pathModules}/${res}/${CONST.MODULE_JSON_NAME}`)
            .then(json => {
              generate.jsonFile = json
              return resolve(generate)
            })
            .catch(reject)
          })
          .catch(reject)
        }
      })
      .catch(reject)
    })
  })
}

/* replaces a prefix by another one -> Common ? */
let replacePrefix = (str, oldPrefix, newPrefix) => {
  if (!str.startsWith(oldPrefix)) { return str } else { return `${newPrefix}${str.substring(oldPrefix.length)}` }
}

/* lists, prompts and customizes variables values and names */
let customizeVariablesPromise = (generate) => {
  if (generate.debug) { Debug(generate) }
  return new Promise((resolve, reject) => {
    generate.variablesMap = {}
    generate.nicknames = {}
    for (let item of generate.jsonFile.classes) {
      // item.checked before here in if condition
      if (item.variables) {
        for (let variable of item.variables) {
          generate.variablesMap[variable.name] = { from: variable.value, type: 'css' }
        }
        generate.nicknames[item.name] = true
      }
    }
    for (let item of generate.jsonFile.js.instancesVar) {
      generate.variablesMap[item.name] = { from: item.value, type: 'js' } // item.type not used
    }
    let questions = []
    for (let variable in generate.variablesMap) {
      questions.push({
        name: variable,
        message: `value of ${generate.variablesMap[variable].type} variable ${variable} `,
        default: generate.variablesMap[variable].from
      })
    }
    if (!questions.length) { return resolve(generate) }
    Prompt(questions)
    .then(answer => {
      for (let variable in generate.variablesMap) {
        generate.variablesMap[variable].to = answer[variable]
      }
      let nicknamesQuestions = []
      if (generate.rename) {
        for (let nickname in generate.nicknames) {
          nicknamesQuestions.push({
            name: nickname,
            message: `instance name to replace ${nickname}`,
            default: replacePrefix(nickname, generate.jsonFile.name, generate.nickname)
          })
        }
      } else {
        for (let className in generate.nicknames) {
          generate.nicknames[className] = replacePrefix(className, generate.jsonFile.name, generate.nickname)
        }
        return resolve(generate)
      }
      if (!nicknamesQuestions.length) { return resolve(generate) }
      Prompt(nicknamesQuestions)
      .then(answer => {
        for (let className in generate.nicknames) {
          generate.nicknames[className] = answer[className] || replacePrefix(className, generate.jsonFile.name, generate.nickname)
        }
        return resolve(generate)
      })
      .catch(reject)
    })
  })
}

/* creates instance folder, files and updates them */
let processGenerateFilesPromise = (generate) => {
  return new Promise((resolve, reject) => {
    Fs.mkdir(`${generate.pathFinal}/${CONST.INSTANCE_FOLDER}`, err => {
      if (err && err.code !== 'EEXIST') { return reject(err) }
      let promises = []
      promises.push(Css.generateInstancePromise(generate))
      promises.push(Js.generateInstancePromise(generate))
      promises.push(Html.generateInstancePromise(generate))
      Promise.all(promises)
      .then(() => resolve(generate))
      .catch(reject)
    })
  })
}

/* PROJECT GENERATE : to generate a module's new instance */
module.exports = (Program) => {
  return new Promise((resolve, reject) => {
    Program
    .command('generate')
    .alias('g')
    .description(`to generate a module's new instance`)
    .arguments('[moduleName]')
    .option('--assign <variable>', `to store the js instance in a variable declaration`)
    .option('--scss', `if you use scss preprocessing language, css by default`)
    .option('-f, --force', 'to force to write the requested instance')
    .option('--debug', 'to display debug logs')
    .action((moduleName, options) => {
      defineGeneratePathsPromise({
        name: moduleName,
        force: options.force,
        debug: options.debug,
        jsStandard: options.jsStandard,
        assign: options.assign,
        successes: [],
        warnings: [],
        style: 'css'
      })
      .then(parsePackagePromise)
      .then(selectModulePromise)
      .then(customizeVariablesPromise)
      .then(processGenerateFilesPromise)
      .then(Common.displayMessagesPromise)
      .then(resolve)
      .catch(reject)
    })
  })
}

/*    ----------------------------------------------------------------------------------------     */

// /* Checks if the potential file containing the new instance isn't alreay existing */
// let checkInstanceAvailablePromise = (generate) => {
//   if (generate.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     if (!generate.nickname) {
//       generate.nickname = generate.jsonFile.name
//     }
//     generate.pathInstance = `${generate.pathModules}/${generate.moduleName}/dist/${generate.nickname}.${generate.style}`
//     if (generate.isForce) {
//       Fs.unlink(generate.pathInstance, err => {
//         if (err && err.code !== 'ENOENT') { return reject(err) }
//         return resolve(generate)
//       })
//     } else if (Fs.existsSync(generate.pathInstance)) {
//       return reject(new Error(`${generate.nickname} instance already exists in module ${generate.moduleName} - use option -f to force`))
//     } else {
//       return resolve(generate)
//     }
//   })
// }

// /* adds imports in files using the new instance(s) */
// let updateUsedFiles = (generate) => {
//   if (generate.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     if (!generate.use) { return resolve(generate) }
//     generate.pathInstances = {}
//     generate.pathInstances[generate.pathInstance] = {
//       module: generate.moduleName,
//       instance: generate.nickname
//     }
//     generate.usePathes = {}
//     if (generate.use === true) {
//       generate.usePathes[`./${generate.jsonFile.entry}`] = generate.jsonFile.entry
//     } else {
//       for (let tmpPath of generate.use.split(' ')) {
//         generate.usePathes[tmpPath] = tmpPath
//       }
//     }
//     Common.updateUsedFilesPromise(generate)
//     .then(resolve)
//     .catch(reject)
//   })
// }
