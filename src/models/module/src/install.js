let Fs = require('fs')
let Path = require('path')
let Request = require('request')
let Tree = require('../lib/tree')
let Models = require('../lib/models')
let Debug = require('../../../lib/debug')
let CONST = require('../../../lib/const')
let Common = require('../../../lib/common')

/* checks for project and module context */
let defineInstallPathsPromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    install.pathInitial = Common.getCurrentPath()
    Common.findProjectJsonPromise(install.pathInitial)
    .then(path => {
      install.pathProject = path
      Common.findModuleJsonPromise(install.pathInitial)
      .then(path => {
        install.pathModule = path
        if (!install.pathProject && !install.pathModule) {
          if (!install.names.length) {
            return reject(new Error(`no module or project detected in your current path - no dependency to be installed`))
          }
          install.warnings.push('no module or project detected - install in current path')
        }
        return resolve(install)
      })
      .catch(reject)
    })
    .catch(reject)
  })
}

/* creates registry and spm_modules folder at the action's root level */
let createModuleDirectoryPromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    Fs.mkdir(CONST.SPM_DIRECTORY, err => {
      if (err && err.code !== 'EEXIST') { return reject(err) }
      Fs.mkdir(CONST.REGISTRY_PATH, err => {
        if (err && err.code !== 'EEXIST') { return reject(err) }
        install.pathRegistry = CONST.REGISTRY_PATH
        install.pathFinal = install.pathModule || install.pathProject || install.pathInitial
        install.pathJson = install.pathModule ? `${install.pathModule}/${CONST.MODULE_JSON_NAME}` : install.pathProject ? `${install.pathProject}/${CONST.PROJECT_JSON_NAME}` : null
        install.pathModules = install.isRegistry ? install.pathRegistry : `${install.pathFinal}/spm_modules`
        install.current.path = `${install.pathModules}`
        return resolve(install)
      })
    })
  })
}

/* parses one module's json file to queue up its dependencies */
let getDependenciesInstallPromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    if (install.pathJson) {
      Common.getJsonFilePromise(`${install.pathJson}`)
      .then(json => {
        if (!json) {
          return reject(new Error(`${install.pathModule ? 'module' : 'project'} detected but no json file in ${install.pathModule || install.pathProject}`))
        } else {
          install.jsonFile = JSON.parse(JSON.stringify(json))
          if (!install.style) {
            install.style = json.style
            install.warnings.push(`default style has been set to ${json.style}`)
          }
          if (install.names.length === 0) {
            if (install.isSave) { install.warnings.push(`Are you trying to save what's already save ? inc3p7i0n a13rt ;-)`) }
            if (json.dependencies && typeof json.dependencies === 'object' && Object.keys(json.dependencies).length) {
              install.current.jsonFile.dependencies = json.dependencies
              return resolve(install)
            } else { return reject(new Error(`no dependency to install from ${install.pathJson}`)) }
          } else {
            install.addDependenciesNames(install.names)
            return resolve(install)
          }
        }
      })
      .catch(reject)
    } else {
      install.addDependenciesNames(install.names)
      return resolve(install)
    }
  })
}

/* requests the spm registry for a package's json file */
let getJsonPackageFromAPIPromise = (install) => {
  if (install.debug) { Debug(install) }
  return new Promise((resolve, reject) => {
    let url = `${CONST.PACKAGE_URL}/install/${install.current.name}`
    if (install.current.version && install.current.version !== true) { url += `?version=${install.current.version}` }
    Request(url, (err, response, body) => {
      body = JSON.parse(body)
      if (err) {
        if (err.code === 'ECONNREFUSED') { return reject(new Error('Server down check method getJsonApiPromise')) } else { return reject(err) }
      } else if (Math.floor(body.statusCode / 100) >= 4) {
        return reject(new Error(`API error for package ${install.current.name}: ${body.message}`))
      } else {
        let dependencies = JSON.parse(JSON.stringify(body.dependencies))
        install.current.jsonFile = body
        install.current.jsonFile.dependencies = {}
        if (dependencies) {
          for (let item of dependencies) {
            let name = item.name
            delete item.name
            install.current.jsonFile.dependencies[name] = item
            // add semantic versioning here
          }
        }
        install.current.version = install.current.jsonFile.version
        return resolve(install)
      }
    })
  })
}

/* checks if a package is already being installed to avoid duplication */
let alreadyInList = (type, install) => {
  if (install.debug) { Debug() }
  switch (type) {
    case 'download':
      for (let item of install.downloadList) {
        if (item.name === install.current.name) {
          if (item.version === install.current.version) {
            install.current.target = `${item.path}/spm_modules/${install.current.name}`
            install.current.newPromise = item.promise
            if (install.debug) { Debug(`${item.name}&${item.version} already in List : ${install.current.target}`) }
            return true
          } else if (install.current.bestPath && !Common.unrealRelativePath(install.current.bestPath, install.current.path.split('/').slice(0, item.path.split('/').length + 1).join('/')).startsWith('../../../')) {
            install.current.bestPath = install.current.path.split('/').slice(0, item.path.split('/').length + 1).join('/')
          }
        }
      }
      break
    case 'symlink':
      for (let item of install.symlinkList) {
        if (item.name === install.current.name && item.version === install.current.version &&
          (item.path === install.current.path && item.target === install.current.target)) { return true }
      }
      break
    // case 'instance':
    //   for (let item of install.instancesList) {
    //     if (item.target === install.current.target && item.name === install.current.instanceName) { return true }
    //   }
    //   break
  }
  if (install.current.bestPath) { install.current.target = `${install.current.bestPath}/${install.current.name}` }
  if (install.debug) { Debug(`end of alreadyInList with ${type}, target = ${install.current.target}, pathFinal = ${install.pathFinal}`) }
  return false
}

/* create required directories for module installation */
let createDirectoriesSourcePromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    let currentDirectory = install.pathFinal
    while (Common.unrealRelativePath(currentDirectory, `${install.current.path}/${install.current.name}`) !== '') {
      if (!install.directoryList.includes(Common.cleanFilePath(currentDirectory)) && !Common.directoryExists(currentDirectory)) {
        install.directoryList.push(Common.cleanFilePath(currentDirectory))
        if (install.debug) { Debug('creating directory2', currentDirectory) }
        Fs.mkdirSync(currentDirectory)
      }
      currentDirectory = `${currentDirectory}/${Common.unrealRelativePath(currentDirectory, `${install.current.path}/${install.current.name}`).split('/')[0]}`
    }
    return resolve(install)
  })
}

/* creates required directories for symlinks so everything can be asynchronously downloaded */
let createDirectoriesTargetPath = (install) => {
  if (install.debug) { Debug() }
  try {
    let unrealRelativePath = Common.unrealRelativePath(install.pathFinal, install.current.target)
    let currentDirectory = unrealRelativePath.startsWith('..') ? CONST.REGISTRY_PATH : install.pathFinal
    while (Common.unrealRelativePath(currentDirectory, `${install.current.target}/${CONST.INSTANCE_FOLDER}`) !== '') {
      if (!install.directoryList.includes(Common.cleanFilePath(currentDirectory)) && !Common.directoryExists(currentDirectory)) {
        install.directoryList.push(Common.cleanFilePath(currentDirectory))
        if (install.debug) { Debug('creating directory1', currentDirectory) }
        Fs.mkdirSync(currentDirectory)
      }
      currentDirectory = `${currentDirectory}/${Common.unrealRelativePath(currentDirectory, `${install.current.target}/${CONST.INSTANCE_FOLDER}`).split('/')[0]}`
    }
    return install
  } catch (err) {
    if (install.debug) { Debug('error in createDirectoriesTargetPath\n', err) }
    return null
  }
}

/* after installation, default values initialized for potential instances */
let defineParametersOrderPromise = (current, install) => {
  if (install.debug) { Debug() }
  // TODO => génération de l'instance javascript en plus
  return new Promise((resolve, reject) => {
    try {
      Fs.mkdir(`${current.parentPath}/${CONST.INSTANCE_FOLDER}`, err => {
        if (err && err.code !== 'EEXIST') { return reject(err) }
        Fs.readFile(`${current.target}/${current.jsonFile.files.style}`, 'utf8', (err, data) => {
          if (err && err !== 'ENOENT') { return reject(err) } else if (err) { return reject(new Error(`incorrect entry file in module ${current.name}@${current.version}`)) }
          let i = data.indexOf(`@mixin ${current.jsonFile.mainClass}(`)
          i = i + `@mixin ${current.jsonFile.mainClass}(`.length
          let j = data.indexOf(')', i)
          let k
          // let parameters = ''
          current.ssParameters = []
          current.ssDefaultMapping = {}
          for (let moduleClass of current.jsonFile.classes) {
            for (let classVariable of moduleClass.variables) {
              current.ssDefaultMapping[classVariable.name] = classVariable.value
            }
          }
          while ((k = data.indexOf(',', i)) >= 0 && k < j) {
            if (data.substring(i, k).startsWith('$_local-')) {
              // parameters += `$_${data.substring(i + 7, k)},`
            } else if (data.substring(i, k).startsWith('$_')) { // variabiliser le marquer pour sa longueur
              // parameters += `${current.ssDefaultMapping[data.substring(i + 2, k)]},`
              current.ssParameters.push(data.substring(i + 2, k))
            }
            i = k + 1
          }
          return resolve(install)
        })
      })
    } catch (err) {
      return reject(err)
    }
  })
}

/* Checks if a module is already in the registry PROMISE */
let isInRegistryPromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    let registryPath = `${CONST.REGISTRY_PATH}/${install.current.name}/${install.current.version}`
    Fs.access(registryPath, err => {
      if (err && err.code !== 'ENOENT') {
        return reject(err)
      } else if (err) {
        if (install.isRegistry) { install.current.target = `${CONST.REGISTRY_PATH}/${install.current.name}/${install.current.version}` }
        return resolve(false) // add check for package.json + another file at root level
      } else {
        install.current.target = `${CONST.REGISTRY_PATH}/${install.current.name}/${install.current.version}`
        return resolve(true)
      }
    })
  })
}

/* recursive check of a module's version */
let isInLocalRecursivePromise = (install, currentDirectory = install.current.path, previousPath = null) => {
  return new Promise((resolve, reject) => {
    if (!install.current.secondLevel && Path.relative(currentDirectory, install.pathFinal).startsWith('..')) {
      Common.getJsonFilePromise(`${currentDirectory}/${install.current.name}/${CONST.MODULE_JSON_NAME}`)
      .then(json => {
        if (json) {
          if (json.version === install.current.version) {
            install.current.target = `${currentDirectory}/${install.current.name}`
            return resolve(true)
          } else if (previousPath) {
            install.current.bestPath = install.current.bestPath || `${previousPath}/spm_modules`
          } else {
            install.current.enable = false
            install.warnings.push(`${install.current.name} already in project with version ${json.version} - you can replace it using install --force`)
            return resolve(true)
          }
        }
        previousPath = currentDirectory
        currentDirectory = currentDirectory.substring(0, currentDirectory.lastIndexOf('/'))
        currentDirectory = currentDirectory.substring(0, currentDirectory.lastIndexOf('/'))
        isInLocalRecursivePromise(install, currentDirectory, previousPath)
        .then(resolve)
        .catch(reject)
      })
      .catch(reject)
    } else {
      install.current.bestPath = install.current.bestPath || `${install.pathFinal}/spm_modules`
      return resolve(false)
    }
  })
}

/* Checks if a module is already in an action's spm_modules PROMISE */
let isInLocalPromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    isInLocalRecursivePromise(install)
    .then(resolve)
    .catch(reject)
  })
}

let checkInRegistryPromise = (install) => {
  return new Promise((resolve, reject) => {
    if (!install.isForce) {
      isInRegistryPromise(install)
      .then(val => {
        if (val) { return resolve(true) } else { return resolve(alreadyInList('download', install)) }
      })
      .catch(reject)
    } else { return resolve(alreadyInList('download', install)) }
  })
}

let checkInLocalPromise = (install) => {
  return new Promise((resolve, reject) => {
    if (!install.isForce) {
      isInLocalPromise(install)
      .then(val => {
        if (val) { return resolve(true) } else { return resolve(alreadyInList('download', install)) }
      })
      .catch(reject)
    } else { return resolve(alreadyInList('download', install)) }
  })
}

/* defines what has to be done with the module */
let defineActionToPerformPromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    if (!alreadyInList('symlink', install)) {
      if (!install.isLocal) {
        checkInRegistryPromise(install)
        .then(val => {
          if (val) { return resolve(true) } else {
            if (!install.isRegistry) {
              checkInLocalPromise(install)
              .then(resolve)
              .catch(reject)
            } else { return resolve(false) }
          }
        })
        .catch(reject)
      } else if (!install.isRegistry) {
        checkInLocalPromise(install)
        .then(resolve)
        .catch(reject)
      } else { return resolve(false) }
    } else { return resolve(false) }
  })
}

/* adds all instances required by the dependency */
// let processCurrentInstancesPromise = (install, current) => {
//   return new Promise((resolve, reject) => {
//     if (current.target && !alreadyInList('instance', install))
//       // && (install.isForce || !Fs.existsSync(`${install.current.target}/${CONST.INSTANCE_FOLDER}/${instance}.scss`))
//     {
//       if (!install.directoryList.includes(Common.cleanFilePath(`${install.current.target}/${CONST.INSTANCE_FOLDER}`))) {
//         install.directoryList.push(Common.cleanFilePath(`${install.current.target}/${CONST.INSTANCE_FOLDER}`))
//         Common.createFolderIfUnexistantSync(`${install.current.target}/${CONST.INSTANCE_FOLDER}`)
//       }
//       Fs.readFile(`${current.target}/${CONST.INSTANCE_FOLDER}/${CONST.INSTANCE_FOLDER}.scss`, 'utf8', (err, data) => {
//         if (err) { return reject(err) }
//         for (let instance in current.instances) {
//           let index = data.indexOf(`'${instance}');\n`)
//           if (index !== -1 && install.isForce) {
//             let startIndex = 0
//             while (data.indexOf(`'${instance}');\n`, startIndex) >= 0) { startIndex = data.indexOf(`');\n`, startIndex) + 4 }
//             data = `${data.substring(0, startIndex)}${data.substring(index + `'${instance}');\n`.length)}`
//           }
//           // if (index === -1 || install.isForce) {
//           //   console.log('TODO MOFO', current.instances[instance])
//           //   data += `//instance to be created;\n`
//           // }
//           // install.instanceList.push({
//           //   path: `${current.target}/${CONST.INSTANCE_FOLDER}`,
//           //   name: instance,
//           //   variables: current.instances[instance]
//           // })
//           //install.current.instances[instance]

//           // install.current.newPromise = install.current.newPromise.then(() => {
//           //   return Common.createInstancePromise(instance, install.current.target, install.current.jsonFile.files.style, install.current.instances[instance], install.current.jsonFile.classes)
//           // })
//           // install.instancePromises.push(current.newPromise)
//         }
//       })
//     }
//   })
// }

/* all the magic happens here : checks if a package has to be installed, symlinked and instantiated */
let createListRecursivePromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    install.current.newPromise = new Promise((resolve, reject) => { return resolve() })
    // the dependency already exists or is being installed
    defineActionToPerformPromise(install)
    .then(alreadyHandled => {
      if (alreadyHandled) {
        if (install.current.enable) {
          if (`${install.current.path}/${install.current.name}` === install.current.target) {
            if (!install.current.secondLevelPath) {
              install.warnings.push(`package ${install.current.name}@${install.current.version} already in project - use --force for reinstallation`)
            }
            return resolve(install.current)
          } else {
            if (install.debug) { Debug('=> symlinking', install.current.name, 'dans', install.current.path, 'vers', install.current.target) }
            install.current.newPromise = install.current.newPromise.then(() => { return Common.createSymlinkPromise(`${install.current.path}/${install.current.name}`, install.current.target) })
            install.symlinkPromises.push(install.current.newPromise)
            install.symlinkList.push({
              name: install.current.name,
              version: install.current.version,
              path: `${install.current.path}/${install.current.name}`,
              target: install.current.target
            })
          }
        }
      } else {
        if (install.debug) { Debug('=> downloading in folder') }
        if (!install.current.target) { install.current.target = `${install.current.path}/${install.current.name}` }
        install.current.newPromise = createDirectoriesSourcePromise(install)
        .then(() => Common.downloadModuleSpmPromise(install.current.name, install.current.version, install.current.target))
        .then(() => Common.writeContent(JSON.stringify(install.current.jsonFile, null, '  ') + '\n', `${install.current.target}/${CONST.MODULE_JSON_NAME}`, '', install.current))
        .then(() => defineParametersOrderPromise(install.current, install))
        .then(() => {
          install.current.instancesObj.ssParameters = install.current.ssParameters
          install.current.instancesObj.json = install.current.jsonFile
          return resolve(install.current)
        })
        install.downloadPromises.push(install.current.newPromise)
        install.downloadList.push({
          name: install.current.name,
          version: install.current.version,
          path: install.current.target,
          promise: install.current.newPromise
        })
        // to improve the lightness of a package, the content isn't installed twice and a symlink is used the second time
        if (install.current.target && Common.unrealRelativePath(`${install.current.path}/${install.current.name}`, install.current.target) !== '') {
          if (install.debug) { Debug('=> on symlink dans', install.current.path, 'vers', `${install.current.target}`) }
          install.current.newPromise = install.current.newPromise.then(() => { return Common.createSymlinkPromise(`${install.current.path}/${install.current.name}`, install.current.target) })
          install.symlinkPromises.push(install.current.newPromise)
          install.symlinkList.push({
            name: install.current.name,
            version: install.current.version,
            path: `${install.current.path}/${install.current.name}`,
            target: `${install.current.target}`
          })
        }
      }
      if (install.current.enable) {
        if (!createDirectoriesTargetPath(install)) { return reject(new Error('error creating working directories')) }
        if (install.debug) { Debug('\n\n: == INSTALL AFTER == :\n\n', install.current, '\n\n ================= \n\n') }
        // if (install.current.instances && install.current.instances.length) { processCurrentInstancesPromise(install, install.current).catch(reject) }
        loopForInPromise(install)
        .then(resolve)
        .catch(reject)
      }
    })
    .catch(reject)
  })
}

/* recursively loops inside a packge to install its dependencies, their dependencies, until everything is downloaded */
let loopForInRecursivePromise = (install, table, index = 0, promises = []) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    if (index >= table.length) {
      return resolve(promises)
    } else {
      let name = table[index].name
      if (install.debug) { Debug('=====PARENT=====\n', 'for', name, '\n', `${install.current.target || 'project'}`, '\n===============') }
      let installBis = Object.assign({}, install)
      installBis.current = {jsonFile: {dependencies: {}}}
      installBis.current.name = name
      installBis.current.version = table[index].version
      installBis.current.enable = true
      installBis.finalInstances = []
      /* mieux gérer les instances */
      installBis.current.instancesObj = { name, target: install.current.target || install.pathFinal }
      install.finalInstances.push(installBis.current.instancesObj)
      // install.instancesList.push(installBis.current.instancesObj)
      /*                           */
      installBis.current.parentPath = install.current.target || install.pathFinal
      installBis.current.path = install.current.parentPath ? `${install.current.target}/spm_modules` : install.current.path
      installBis.current.secondLevelPath = install.current.parentPath ? install.current.secondLevelPath || `${install.current.target}/spm_modules` : null
      getJsonPackageFromAPIPromise(installBis)
      .then(installBis => {
        install.current.arborescence[name] = {
          version: installBis.current.jsonFile.version,
          instances: install.current.parentPath ? install.current.jsonFile.dependencies[name].instances || {} : {},
          display: installBis.current,
          dependencies: {}
        }
        installBis.current.arborescence = install.current.arborescence[name].dependencies
        if (install.debug) { Debug('\n*-* INSTALL BEFORE*-*\n', installBis.current, '\n*****************************\n') }
        promises.push(createListRecursivePromise(installBis))
        loopForInRecursivePromise(install, table, index + 1, promises)
        .then(resolve)
        .catch(reject)
      })
      .catch(reject)
    }
  })
}

/* createInstanceFilePromise */
let createInstanceFilePromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    Common.createInstancePromise(install)
    .then(() => {
      return resolve(install)
      // if (install.style === 'css') {
      //   // que transforme-t-on en css ?
      //   let promises = []
      //   for (let module of install.instancesList) {
      //     promises.push(Common.convertScssToCss(`${module.target}/${CONST.INSTANCE_FOLDER}/${CONST.INSTANCE_FOLDER}.scss`, `${module.target}/${CONST.INSTANCE_FOLDER}/.${CONST.INSTANCE_FOLDER}.css`))
      //   }
      //   Promise.all(promises)
      //   .then(() => resolve(install))
      //   .catch(reject)
      // } else { return resolve(install) }
    })
    .catch(reject)
  })
}

/* ensures all dependencies have been installed and resolves */
let loopForInPromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    let dependencies = Object.keys(install.current.jsonFile.dependencies)
    let index = 0
    for (let key of dependencies) {
      dependencies[index] = {name: key, version: (install.current.jsonFile.dependencies[key] || {}).version, instances: (install.current.jsonFile.dependencies[key] || {}).instances}
      index++
    }
    if (install.debug) { Debug('dependencies', dependencies) }
    loopForInRecursivePromise(install, dependencies)
    .then(res => Promise.all(res))
    .then(() => resolve(install))
    .catch(reject)
  })
}

/* waits until all downloads, symlinks and instances have been created and resolves */
let checkAllActionsPromise = (install) => {
  if (install.debug) { Debug(install.current) }
  return new Promise((resolve, reject) => {
    Promise.all(install.downloadPromises.concat(install.symlinkPromises)) // .concat(install.instancePromises)
    .then(res => {
      let promises = []
      Promise.all(promises)
      .then(() => {
        createInstanceFilePromise(install)
        .then(resolve)
        .catch(reject)
      })
      .catch(reject)
    })
    .catch(reject)
  })
}

/* Adds packages in package-spm.json if flag --save */
let savePackagesPromise = (install) => {
  if (install.debug) { Debug() }
  return new Promise((resolve, reject) => {
    if (!install.isSave) {
      return resolve(install)
    }
    for (let key in install.current.arborescence) {
      if (install.jsonFile.dependencies[key] && !install.isForce) {
        install.warnings.push(`${key} already in dependencies - solve manually`)
      } else {
        install.current.jsonFile.dependencies[key] = { version: install.current.arborescence[key].version }
        install.successes.push(`${key}@${install.current.arborescence[key].version} added in dependencies`)
      }
    }
    install.jsonFile = Object.assign(install.jsonFile, { dependencies: install.current.jsonFile.dependencies })
    Common.writeContent(JSON.stringify(install.jsonFile, null, '  ') + '\n', install.pathJson, '', install)
    .then(resolve)
    .catch(reject)
  })
}

/* PROJECT INSTALL : to use a specific module as a dependency */
module.exports = (Program) => {
  return new Promise((resolve, reject) => {
    Program
    .command('install')
    .alias('i')
    .description(`to use a specific module as a dependency`)
    .arguments('[names...]')
    .option('-l, --local', 'to copy it in your local spm_modules')
    .option('-r, --registry', 'to copy it in your ~/.spm/registry')
    .option('-s, --save', 'to add to dependencies in your local package.json')
    .option('-d, --dev', 'to add to dev dependencies')
    .option('-p, --prod', 'to only install dependencies')
    .option('--style <style>', `if you use scss preprocessing language, css by default`, /^(css|scss)$/i)
    .option('-f, --force', 'to force the install of all modules, including modules already installed')
    .option('--debug', 'to display debug logs')
    .action((names, options) => {
      let install = new Models.Install(names, options)
      defineInstallPathsPromise(install)
      .then(createModuleDirectoryPromise)
      .then(getDependenciesInstallPromise)
      .then(loopForInPromise)
      .then(checkAllActionsPromise)
      .then(Tree.prepareTreeDisplayPromise)
      .then(savePackagesPromise)
      .then(Common.displayMessagesPromise)
      .then(resolve)
      .catch(reject)
    })
  })
}
