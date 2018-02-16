let Fs = require('fs')
// let Path = require('path')
// let Prompt = require('inquirer').prompt
let Chalk = require('chalk')
// let Request = require('request')
// let Sass = require('node-sass')
// let Js = require('../lib/js')
// let Css = require('../lib/css')
let Html = require('../lib/html')
let Models = require('../lib/models')
let CONST = require('../../../lib/const')
let Debug = require('../../../lib/debug')
let Common = require('../../../lib/common')
// let Authentify = require('./authentify')
// let Spinner = require('./spinner')

/* Detect if in the scope of a project */
let testProjectScopePromise = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    Common.findProjectJsonPromise(publish.initialPath)
    .then(path => {
      publish.projectPath = path
      return resolve(publish)
    })
    .catch(reject)
  })
}

/* search down for targeted module-spm.json from project folder or HOME */
let downRecursiveModuleNameSearchPromise = (publish, currentDirectory) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    Fs.lstat(currentDirectory, (err, stats) => {
      if (err) { return reject(err) }
      if (!stats.isDirectory()) { return resolve(null) } else {
        Common.getJsonFilePromise(`${currentDirectory}/${CONST.MODULE_JSON_NAME}`)
        .then(json => {
          if (!json || (publish.name && json.name !== publish.name)) {
            Fs.readdir(currentDirectory, (err, files) => {
              if (err) { return reject(err) }
              let promises = []
              for (let file of files) {
                promises.push(downRecursiveModuleNameSearchPromise(publish, `${currentDirectory}/${file}`))
              }
              Promise.all(promises)
              .then(resPublishes => {
                for (let resPublish of resPublishes) {
                  if (resPublish) { return resolve(resPublish) }
                }
                return resolve(null)
              })
              .catch(reject)
            })
          } else {
            publish.json = json
            publish.path = currentDirectory
            return resolve(publish)
          }
        })
        .catch(reject)
      }
    })
  })
}

/* search up for targeted module-spm.json until project folder or HOME */
let upRecursiveModuleNameSearchPromise = (publish, currentDirectory) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    if (!currentDirectory) {
      return reject(new Error(CONST.ERROR.SPM_MODULE_NOT_FOUND))
    } else if (currentDirectory.indexOf(publish.projectPath || CONST.USER_DIRECTORY) === -1) {
      downRecursiveModuleNameSearchPromise(publish, publish.projectPath || CONST.USER_DIRECTORY).then(resolve).catch(reject)
    } else {
      Common.getJsonFilePromise(`${currentDirectory}/${CONST.MODULE_JSON_NAME}`)
      .then(json => {
        if (!json || (publish.name && json.name !== publish.name)) {
          upRecursiveModuleNameSearchPromise(publish, currentDirectory.substring(0, currentDirectory.lastIndexOf('/')))
          .then(resolve)
          .catch(reject)
        } else {
          publish.json = json
          publish.path = currentDirectory
          return resolve(publish)
        }
      })
      .catch(reject)
    }
  })
}

/* parse project json file */
let getModuleJsonPromise = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    if (!publish.name) {
      Common.findModuleJsonPromise(publish.initialPath, publish.projectPath || CONST.USER_DIRECTORY)
      .then(path => {
        if (!path) { return reject(new Error(CONST.ERROR.SPM_MODULE_NOT_FOUND)) }
        publish.path = path
        Common.getJsonFilePromise(`${path}/${CONST.MODULE_JSON_NAME}`)
        .then(json => {
          publish.json = json
          return resolve(publish)
        })
        .catch(reject)
      })
    } else {
      upRecursiveModuleNameSearchPromise(publish, publish.initialPath)
      .then(resolve)
      .catch(reject)
    }
  })
}

/* Checks the module parameters and suggests 'spm2 module edit' if not found */
let checkModuleJsonPromise = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    const keyMaps = {
      name: {
        regex: /^(?!^spm_modules$).{2,}$/,
        message: `name should be longer than 2 characters (value spm_modules forbidden) - use 'spm2 module edit --name <name>'`
      },
      version: {
        regex: /^[0-9]+[.][0-9]+[.][0-9]+$/,
        message: `Incorrect version in package-spm.json - use 'spm2 module edit --version <version>'`
      },
      style: {
        regex: /^(?:css|scss)$/,
        message: `your style should be css or scss - use 'spm2 module edit --style <style>'`
      },
      mainClass: {
        regex: /^.{2,}$/,
        message: `main class should be longer than 2 characters - use 'spm2 module edit --main-class <mainClass>'`
      },
      description: {
        regex: false,
        message: `missing description - use 'spm2 module edit --description  <description>'`
      },
      category: {
        regex: false,
        message: `missing category - use 'spm2 module edit --category <category>'`
      },
      readme: {
        regex: false,
        message: `missing readme - use 'spm2 module edit --readme <readmeFile>'`
      },
      repository: {
        regex: false,
        message: `missing repository - use 'spm2 module edit --repository <repository>'`
      },
      license: {
        regex: false,
        message: `missing license - use 'spm2 module edit --license <license>'`
      }
    }
    const arrays = ['keywords', 'contributors', 'classes', 'responsive']
    for (let key in keyMaps) {
      if (publish.json[key] === undefined || publish.json[key] === null || (keyMaps[key].regex && !keyMaps[key].regex.test(publish.json[key]))) { return reject(new Error(keyMaps[key].message)) }
    }
    for (let moduleArray of arrays) {
      if (!publish.json[moduleArray] || !(publish.json[moduleArray] instanceof Array)) {
        return reject(new Error(`incorrect ${moduleArray} - use 'spm2 module edit --${moduleArray} <${moduleArray}>'`))
      }
    }
    return resolve(publish)
  })
}

/* html checker */
let htmlFileCheckerPromise = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    Fs.access(`${publish.path}/${publish.json.name}.html`, Fs.constants.F_OK, (err) => {
      if (err && !publish.projectPath) {
        return reject(new Error(`reference html file not found in your module`))
      } else if (err || publish.htmlChecker) {
        Html.conflictSolverPromise(`${publish.projectPath}`, publish.json.mainClass)
        .then(patternList => {
          if (!patternList.length) { return reject(new Error(`main class not found in your project`)) }
          let data = ''
          let alreadyAdded = []
          for (let pattern of patternList) {
            if (!alreadyAdded.includes(pattern.str)) {
              data += `<!--============= pattern found in ${pattern.file}-->\n${pattern.str}\n<!--============= end of pattern-->\n\n`
              alreadyAdded.push(pattern.str)
            }
          }
          Fs.writeFile(`${publish.path}/${publish.json.name}.html`, data, err => {
            if (err) { return reject(err) }
            return reject(new Error(`conflicts identified in your file - please validate ${publish.json.name}.html and publish again`))
          })
        })
        .catch(reject)
      } else {
        Html.validatorPromise(`${publish.path}/${publish.json.name}.html`, publish.json.mainClass)
        .then(pattern => {
          publish.dom = pattern[0].str
          return resolve(publish)
        })
        .catch(reject)
      }
    })
  })
}

/* Checks module's files */
let checkModuleFilesPromise = (publish) => {
  if (publish.debug) { Debug() }
  return new Promise((resolve, reject) => {
    let promises = []
    promises.push(htmlFileCheckerPromise(publish))
    Promise.all(promises)
    .then(() => {
      return resolve(publish)
    })
    .catch(reject)
    /* what with the html merge conflict ? => name differs if within a project or not ? */
    // 1 check if they are present | html depends on project existence or not => update of create && edit
    // 2 tricky logic for html if absent
    // 3 launch 3 process for html domParser | javascript parser | (s)css parser
    // 4 resolve()
  })
}

// /* prepares publish workspace */
// let prepareWorkspacePromise = (publish) => {
//   return new Promise((resolve, reject) => {
//   })
// }

// /* cleans publish workspace */
// let cleanWorkspacePromise = (publish) => {
//   return new Promise((resolve, reject) => {
//   })
// }

/* PROJECT PUBLISH : to send your module to spm registry and factory */
module.exports = (Program) => {
  return new Promise((resolve, reject) => {
    Program
    .command('publish')
    .alias('p')
    .description(`to send your module to spm registry and factory`)
    .arguments('[moduleName]')
    .option('-a, --access [access]', 'to specify the authorization level to your module', /^(public|private)$/i, 'public')
    .option('-v, --version <version>', `to specify the module's version`)
    .option('--html-checker', `to force the tool to fix conflicts between html files containing your main class`)
    .option('--debug', 'to display debug logs')
    .action((moduleName, options) => {
      if (options.version && typeof options.version !== 'function' && !/^[0-9]+[.][0-9]+[.][0-9]+$/.test(options.version)) {
        Program.on('--help', () => { console.log(Chalk.hex(CONST.WARNING_COLOR)('please enter a valid version number (x.x.x)')) })
        Program.help()
      } else {
        let publish = new Models.Publish(moduleName, options)
        testProjectScopePromise(publish)
        .then(getModuleJsonPromise)
        .then(checkModuleJsonPromise)
        .then(checkModuleFilesPromise)
        .then(res => { console.log(res); return resolve(res) })
        .catch(reject)
      }
    })
  })
}

/* -------------------------- */

// /* Checks custom dom file and attaches it to the publication */
// let verifyRefDomPromise = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     Fs.readFile(`${publication.path}/ref-dom.html`, 'utf8', (err, data) => {
//       if (err && err.code !== 'ENOENT') {
//         return reject(err)
//       } else if (err) {
//         return reject(new Error('error - reference DOM missing'))
//       }
//       publication.dom = {type: 'custom', value: data}
//       return resolve(publication)
//     })
//   })
// }

// /* Displays the publication and asks the publisher for final confirmation */
// let confirmationPublishPromise = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     console.log(`You are about to publish the module ${publication.name}@${publication.version}\nif you have the rights to publish, your contribution will be added in spm registry`)
//     Common.promptConfirmation(publication, true, 'Do you confirm this ')
//     .then(resolve)
//     .catch(reject)
//   })
// }

// /* Auth module - publication requires a spm account and authorization on existing package */
// let promptUserPromise = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     Authentify.login()
//     .then(token => {
//       publication.token = token
//       return resolve(publication)
//     })
//     .catch(reject)
//   })
// }

// /* adds in ignoreList specific files from .spmignore list */
// let parseIgnoreFiles = (ignoreFiles, publication) => {
//   if (publication.debug) { Debug() }
//   let ignores = []
//   for (let ignoreFile of ignoreFiles) {
//     if (Fs.existsSync(ignoreFile)) {
//       for (let file of Fs.readFileSync(ignoreFile).toString().split('\n')) {
//         if (file !== '') {
//           ignores.push(file)
//         }
//       }
//     }
//   }
//   return ignores
// }

// /* basic files always ignored */
// let updateDefaultIgnoreFiles = (ignores, publication) => {
//   if (publication.debug) { Debug() }
//   let defaultIgnoreFiles = ['.tmp_sass', 'tmp/', '.gitignore', '.spmignore', 'package-spm.json', 'ref-dom.html']
//   for (let ignoreFile of defaultIgnoreFiles) {
//     if (!ignores.includes(ignoreFile)) {
//       ignores.push(ignoreFile)
//     }
//   }
//   return ignores
// }

// /* spm embeds a .spmignore file listing files to ignore */
// let verifyIgnoredFilesPromise = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     let ignores = parseIgnoreFiles([
//       publication.path + '/.gitignore',
//       publication.path + '/.spmignore'
//     ], publication)
//     publication.ignore = updateDefaultIgnoreFiles(ignores, publication)
//     return resolve(publication)
//   })
// }

// /* checks if a given selector has a valid scope included inside one of the publication's classes */
// let parseSelector = (selector, classes, dependenciesMap) => {
//   let item
//   if (selector.indexOf(' ') >= 0) {
//     let table = selector.split(' ')
//     let i = 0
//     if (i >= table.length) { return null } else { item = table[i] }
//   } else { item = selector }
//   let allClasses = classes.concat(Object.keys(dependenciesMap))
//   for (let moduleClass of allClasses) {
//     let i = item.indexOf('.' + moduleClass)
//     if (i >= 0 &&
//       ((i + moduleClass.length + 1 === item.length) || [' ', '\n', '\t', '.', '[', '{', '&', ':', ',', ';'].includes(item[i + moduleClass.length + 1]))) {
//       return item
//     }
//   }
//   return null
// }

// /* checks publication can't impact external elements with a larger-scoped selector */
// let parseSelectors = (data, classes, dependenciesMap) => {
//   let parsed = data.split(',')
//   for (let selector of parsed) {
//     selector = Common.removeWhitespaces(selector)
//     if (!selector.startsWith('@') && !parseSelector(selector, classes, dependenciesMap)) {
//       return false
//     }
//   }
//   return true
// }

// /* high level scope checker for css file */
// let checkClass = (file, publication, style = publication.style) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     Fs.readFile(file, 'utf8', function (err, data) {
//       if (err) { return reject(err) }
//       data = Common.cssCleaner(data)
//       let startIndex = 0
//       let i, j
//       let tmpClasses = publication.classes.concat([publication.main]) // .concat(Object.keys(publication.dependenciesClassesMapping))
//       while ((i = data.indexOf('@import', startIndex)) >= 0) { startIndex = data.indexOf(';', i) + 1 }
//       while (startIndex >= 0 && (i = data.indexOf('@mixin', startIndex)) >= 0) {
//         startIndex = data.indexOf('{', i) + 1
//         let count = 0
//         while (startIndex < data.length &&
//           (data[startIndex] !== '}' || count > 0)) {
//           if (data[startIndex] === '{') { count++ }
//           if (data[startIndex] === '}') { count-- }
//           startIndex++
//         }
//         startIndex++
//       }
//       while ((i = data.indexOf('{', startIndex)) >= 0) {
//         j = data.indexOf('@media', startIndex)
//         if (j < 0 || i < j) {
//           if (!parseSelectors(data.substring(startIndex, i), tmpClasses, publication.dependenciesClassesMapping) && Common.cleanValue(data.substring(startIndex, i)) !== ':root') {
//             return reject(new Error(`incorrect selector found : ${data.substring(startIndex, i)} in ${file}`))
//           }
//           i = data.indexOf('}', i)
//         }
//         startIndex = i + 1
//       }
//       return resolve(publication)
//     })
//   })
// }

// /* Information parser from @import tags */
// let importToFile = (data) => {
//   if (data.length > 2) {
//     if (data.startsWith("'") &&
//       data.split("'").length === 3 &&
//       data.split("'")[0] === '') {
//       return data.split("'")[1]
//     }
//     if (data.startsWith('"') &&
//       data.split('"').length === 3 &&
//       data.split('"')[0] === '') {
//       return data.split('"')[1]
//     }
//     if (data.startsWith('url(') && data.indexOf(')') > 5) {
//       return importToFile(data.substring(4, data.indexOf(')')))
//     }
//   }
//   return null
// }

// /* Checks all import found from the entry file are included in the project */
// let recursiveCheckModule = (path, file, publication) => {
//   if (publication.debug) { Debug() }
//   if (!path.endsWith('/')) { path += '/' }
//   publication.ressources.push(path + file)
//   return new Promise((resolve, reject) => {
//     if (!Fs.existsSync(path + file)) {
//       return reject(new Error(`imported file ${path}${file} doesn't exist`))
//     } else if (Path.relative(publication.path, path + file).startsWith('..')) {
//       // no link should be found to registry since it should link to a symlink in spm_modules/
//       return reject(new Error(`imported file ${path}${file} out of project's scope`))
//     } else {
//       Fs.readFile(path + file, 'utf8', (err, data) => {
//         if (err) {
//           return reject(err)
//         } else {
//           checkClass(path + file, publication)
//           .then(res => {
//             return new Promise((resolve, reject) => {
//               let dataAt = data.split('@import ')
//               let dataAtClose = []
//               for (let elem of dataAt) {
//                 if (elem.indexOf(';') >= 0) {
//                   let resultFile = importToFile(elem.split(';')[0])
//                   if (resultFile && !resultFile.startsWith('http')) {
//                     dataAtClose.push(resultFile)
//                   }
//                 }
//               }
//               let promises = []
//               for (let module of dataAtClose) {
//                 promises.push(recursiveCheckModule(path + module.substring(0, module.lastIndexOf('/')), module.split('/')[module.split('/').length - 1], publication))
//               }
//               Promise.all(promises)
//                 .then(() => { return resolve(publication) })
//                 .catch(reject)
//             })
//           })
//           .then(resolve)
//           .catch(reject)
//         }
//       })
//     }
//   })
// }

// /* Convert the project to css if needed in order to check selectors' scope */
// let scssToCssForCheck = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     if (publication.style === 'scss') {
//       Fs.mkdir(`${publication.path}/.tmp_sass`, err => {
//         if (err && err.code !== 'EEXIST') { return reject(err) }
//         Fs.writeFile(`${publication.path}/.tmp_sass/entry.scss`, `@import '../tmp/${publication.entry}';`, err => {
//           if (err) { return reject(err) }
//           Sass.render({
//             file: `${publication.path}/.tmp_sass/entry.scss`,
//             outFile: `${publication.path}/.tmp_sass/full.css`
//           }, function (error, result) {
//             if (!error) {
//               Fs.writeFile(publication.path + '/.tmp_sass/full.css', result.css, function (err) {
//                 if (!err) {
//                   checkClass(publication.path + '/.tmp_sass/full.css', publication, 'css')
//                   .then(() => {
//                     Common.deleteFolderRecursive(`${publication.path}/.tmp_sass`, () => {
//                       return resolve(publication)
//                     })
//                   })
//                   .catch(reject)
//                 } else { return reject(new Error('error while converting scss file to css')) }
//               })
//             } else { return reject(error.message) } // node-sass error message
//           })
//         })
//       })
//     } else {
//       return resolve(publication)
//     }
//   })
// }

// /* To confirm the deletion of declared and unused dependencies */
// let confirmDependancyRemoval = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     if (Object.keys(publication.removed).length) {
//       let questions = [
//         {
//           type: 'checkbox',
//           name: 'keeping',
//           message: 'spm has detected the following unused dependancies - which one do you want to keep ?\n',
//           choices: Object.keys(publication.removed)
//         }
//       ]
//       Prompt(questions)
//       .then(answer => {
//         let removed = {}
//         console.log('pubRemoved', publication.removed)
//         console.log('keeping', answer.keeping)
//         for (let item in publication.removed) {
//           if (!(answer.keeping).includes(item)) {
//             removed[item] = publication.dependencies[item]
//             delete publication.dependencies[item]
//           }
//         }
//         publication.removed = removed
//         return resolve(publication)
//       })
//       .catch(reject)
//     } else {
//       return resolve(publication)
//     }
//   })
// }

// /* Some dependency can be declared and not used */
// let unusedDependancies = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     let dependencies = Object.assign({}, publication.dependencies)
//     let removed = {}
//     for (let dependency in dependencies) {
//       let flag = false
//       for (let ressource of publication.ressources) {
//         if (Path.relative(`${publication.path}/spm_modules/${dependency}`, ressource.substring(0, ressource.lastIndexOf('/'))) === '') {
//           flag = true
//           break
//         }
//       }
//       if (!flag) {
//         publication.warnings.push(`dependency ${dependency} is not used`)
//         removed[dependency] = dependencies[dependency]
//       }
//     }
//     publication.removed = removed
//     confirmDependancyRemoval(publication)
//     .then(resolve)
//     .catch(reject)
//   })
// }

// /* creates a mapping of all classes related to dependencies object in package.json */
// let mapDependenciesClassesPromise = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     publication.dependenciesClassesMapping = {}
//     let promises = []
//     let promiseList = []
//     for (let dependency in publication.dependencies) {
//       promises.push(Common.getPackageSpmFilePromise(`${publication.path}/spm_modules/${dependency}/package-spm.json`))
//       promiseList.push(dependency)
//     }
//     Promise.all(promises)
//     .then(results => {
//       for (let i = 0; i < results.length; i++) {
//         if (results[i] === null) {
//           delete publication.dependencies[promiseList[i]]
//           publication.warnings.push(`dependency ${promiseList[i]} has no package-spm.json - reinstall using --force`)
//         } else {
//           for (let item of results[i].classes) {
//             publication.dependenciesClassesMapping[item.name] = { module: promiseList[i], instance: promiseList[i] }
//           }
//           for (let instance in publication.dependencies[promiseList[i]].instances) {
//             for (let instanceClass in publication.dependencies[promiseList[i]].instances[instance].classes) {
//               publication.dependenciesClassesMapping[publication.dependencies[promiseList[i]].instances[instance].classes[instanceClass]] = { module: promiseList[i], instance: instance }
//             }
//           }
//         }
//       }
//       return resolve(publication)
//     })
//     .catch(reject)
//   })
// }

// /* deleting the spm_modules from the tmp folder */
// let clearspmModulesTmpPromise = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     Common.deleteFolderRecursivePromise(`${publication.path}/tmp/spm_modules`)
//     .then(() => { return resolve(publication) })
//     .catch(reject)
//   })
// }

// /* Driving the checks -> correct imports & correct dependencies */
// let checkModule = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     recursiveCheckModule(publication.path, publication.entry, publication)
//     .then(scssToCssForCheck)
//     .then(unusedDependancies)
//     .then(clearspmModulesTmpPromise)
//     .then(resolve)
//     .catch(reject)
//   })
// }

// /* recursive directory copier with tmp files logic */
// let recursiveDirectoryCopy = (path, directory, ignores, publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     Fs.mkdir(`${path}/tmp${directory.substring(path.length)}`, err => {
//       if (err && err.code !== 'EEXIST') { return reject(err) }
//       Fs.readdir(directory, (err, files) => {
//         if (err) { return reject(err) }
//         if (files.length > 0) {
//           let promises = []
//           for (let file of files) {
//             if (!ignores.includes(file) && !ignores.includes(file + '/')) {
//               if (Fs.lstatSync(directory + file).isDirectory()) {
//                 if (!file.endsWith('/')) { file += '/' }
//                 let subIgnores = []
//                 for (let ignore of ignores) {
//                   if (ignore.startsWith(file)) {
//                     subIgnores.push(ignore.substring(file.length))
//                   }
//                 }
//                 promises.push(recursiveDirectoryCopy(path, directory + file, subIgnores, publication))
//               } else {
//                 Fs.readFile(directory + file, 'utf8', (err, data) => {
//                   if (err) { return reject(err) }
//                   promises.push(new Promise((resolve, reject) => {
//                     Fs.writeFile(`${path}/tmp${directory.substring(path.length)}${file}`, data, err => {
//                       if (err) { return reject(err) }
//                       return resolve()
//                     })
//                   }))
//                 })
//               }
//             }
//           }
//           Promise.all(promises)
//           .then(resolve)
//           .catch(reject)
//         } else { return resolve() }
//       })
//     })
//   })
// }

// /* initiates the copy folder and the copy functions */
// let publicationCopyPromise = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     Fs.mkdir(`${publication.path}/tmp`, err => {
//       if (err && err.code !== 'EEXIST') { return reject(err) }
//       recursiveDirectoryCopy(publication.path, publication.path + '/', publication.ignore, publication)
//       .then(() => { return resolve(publication) })
//       .catch(reject)
//     })
//   })
// }

// /* tgz creation */
// let createTgzPromise = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     Fs.mkdir(`${publication.path}/.tmp`, err => {
//       if (err && err.code !== 'EEXIST') { return reject(err) }
//       Common.tgzFilePromise(`${publication.path}/tmp`, `${publication.path}/.tmp/${publication.name}.tgz`)
//       .then(() => {
//         return resolve(publication)
//       })
//       .catch(reject)
//     })
//   })
// }

// /* many folders created during publication preparation - clean-up function */
// let cleanUpWorkingDirectory = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     Common.deleteFolderRecursive(`${publication.path}/.sass-cache`, () => {
//       Common.deleteFolderRecursive(`${publication.path}/tmp`, () => {
//         // error management ?
//         Common.deleteFolderRecursive(`${publication.path}/.tmp`, () => {
//           // error management ?
//           return resolve(publication)
//         })
//       })
//     })
//   })
// }

// /* Prepares payload and sends content to spm registry - handles api replies */
// let sendPublicationToRegistryPromise = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     let packageSpm = new PublishPackageSpm(
//       publication.name,
//       publication.version,
//       publication.type,
//       publication.style,
//       publication.main,
//       publication.classes,
//       publication.description,
//       publication.entry,
//       publication.dependencies,
//       publication.scripts,
//       publication.repository,
//       publication.readme,
//       publication.keywords,
//       publication.engines,
//       publication.license,
//       publication.dom,
//       publication.responsiveness,
//       publication.category
//     )
//     let formData = {}
//     formData.package = JSON.stringify(packageSpm)
//     if (publication.debug) console.log('package', formData.package)
//     formData.module = Fs.createReadStream(`${publication.path}/.tmp/${publication.name}.tgz`)
//     // formData.token = publication.token
//     let spinner = new Spinner('sending to registry...', 'monkey')
//     spinner.start()
//     Request.put({
//       url: CONST.PUBLISH_URL,
//       headers: {
//         'Authorization': `bearer ${publication.token}`
//       },
//       formData: formData
//     }, function (error, response, body) {
//       cleanUpWorkingDirectory(publication)
//       .then(() => {
//         if (error) { return reject(spinner.errorStop(`there was an error sending data to spm registry - please try again later or contact our support\n${error}`)) }
//         let res = JSON.parse(body)
//         if (Math.floor(res.statusCode / 100) >= 4) {
//           return reject(spinner.errorStop(res.message))
//         } else {
//           spinner.successStop(`publication correctly processed by spm registry`)
//           if (res.name !== publication.initialName || packageSpm.name) {
//             publication.warnings.push(`your package ${publication.initialName || packageSpm.name} has been renamed to ${res.name} by spm registry`)
//           }
//           publication.successes.push(`${res.name}@${res.version} has been successfully created`)
//           return resolve(publication)
//         }
//       })
//       .catch(reject)
//     })
//   })
// }

// /* High level publication function -> checks, copies, compresses and sends publication to spm registry */
// let publishModulePromise = (publication) => {
//   if (publication.debug) { Debug() }
//   return new Promise((resolve, reject) => {
//     verifyIgnoredFilesPromise(publication)
//     .then(mapDependenciesClassesPromise)
//     .then(publicationCopyPromise)
//     .then(checkModule)
//     .then(createTgzPromise)
//     .then(promptUserPromise)
//     .then(sendPublicationToRegistryPromise)
//     .then(resolve)
//     .catch(reject)
//   })
// }

/* Commander for spm publish */
// module.exports = (Program) => {
//   return new Promise((resolve, reject) => {
//     Program
//     .command('publish')
//     .alias('p')
//     .description('to publish your package in the spm registry')
//     .arguments('[pkg]')
//     .option('-a, --access <access>', 'to specify the authorization level to your module', /^(public|private)$/i, 'public')
//     .option('--debug', 'to display debug logs')
//     .action((pkg, options) => {
//       let publication = new Publish(pkg, options.debug)
//       verifyPackagePromise(publication)
//       .then(verifyRefDomPromise)
//       .then(verifyModulePromise)
//       .then(confirmationPublishPromise)
//       .then(cleanUpWorkingDirectory)
//       .then(publishModulePromise)
//       .then(Common.displayMessagesPromise)
//       .then(resolve)
//       .catch(reject)
//     })
//     .on('--help', function () {})
//   })
// }
