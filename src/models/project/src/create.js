let Prompt = require('inquirer').prompt
let Clear = require('clear')
let Chalk = require('chalk')
let Figlet = require('figlet')
let Common = require('../../../lib/common')
let Model = require('../lib/model')
let CONST = require('../../../lib/const')
let Debug = require('../../../lib/debug')

/* Prompter asking for basic information for package creation */
let createProject = (create) => {
  if (create.debug) { Debug() }
  return new Promise((resolve, reject) => {
    let questionObj = {
      name: {
        name: 'name',
        message: 'project name',
        default: create.name,
        /* spm names are never shorter than 3 characters */
        validate: (value) => {
          return (value.length && value.length > 2) ? true : Chalk.hex(CONST.WARNING_COLOR)('use at least 3 characters')
        }
      },
      style: {
        type: 'list',
        name: 'style',
        choices: ['css', 'scss'],
        default: create.style,
        message: 'default style'
      },
      htmlName: {
        name: 'htmlName',
        /* the entry point by default is index with the project's style extension */
        default: create.htmlName,
        message: `project's main html file`
      },
      jsName: {
        name: 'jsName',
        /* the entry point by default is index with the project's style extension */
        default: create.jsName,
        message: `project's main script`
      },
      ssName: {
        name: 'ssName',
        /* the entry point by default is index with the project's style extension */
        default: (current) => {
          return current.style ? `style.${current.style}` : create.ssName
        },
        message: `project's main stylesheet`
      },
      styleguideName: {
        name: 'styleguideName',
        /* the entry point by default is index with the project's style extension */
        default: (current) => {
          return current.style ? `styleguide.${current.style}` : create.styleguideName
        },
        message: `project's styleguide`
      },
      description: {
        name: 'description',
        message: 'description'
      }
    }
    let questions = []
    for (let key of create.getKeys()) {
      if (typeof create.options[key] === 'function' || !create.options[key]) { questions.push(questionObj[key]) }
    }
    if (questions.length && !create.default) {
      Clear()
      console.log(
        Chalk.hex('#FD7F57')(
          Figlet.textSync('spm', {horizontalLayout: 'full'})
        )
      )
      Prompt(questions)
      .then(answer => {
        for (let key in answer) { create[key] = answer[key] }
        return resolve(create)
      })
      .catch(err => { return reject(new Error(`Prompt error - ${err}`)) })
    } else { return resolve(create) }
  })
}

/* displays the complete package and asks user's confirmation */
let recapAndConfirmPromise = (create) => {
  if (create.debug) { Debug() }
  return new Promise((resolve, reject) => {
    let project = new Model.Project(create)
    create.json = project
    if (!create.default) {
      console.log('About to write to ' + Common.getCurrentPath() + '/project-spm.json')
      console.log(JSON.stringify(project, null, '  '))
      Common.promptConfirmation(project, true)
      .then(() => resolve(create))
      .catch(reject)
    } else { return resolve(create) }
  })
}

/* Calls entry, variables and dom checkers */
let createProjectFilePromise = (create) => {
  if (create.debug) { Debug(create) }
  return new Promise((resolve, reject) => {
    let filesToCreate = [
      {
        name: 'project-spm.json',
        toCreate: true,
        toForce: create.force,
        content: JSON.stringify(create.json, null, '  ')
      },
      {
        name: create.htmlName,
        toCreate: create.options.htmlFile,
        toForce: false,
        content: ''
      },
      {
        name: create.jsName,
        toCreate: create.options.jsFile,
        toForce: false,
        content: ''
      },
      {
        name: create.ssName,
        toCreate: create.options.ssFile,
        toForce: false,
        content: ''
      },
      {
        name: create.styleguideName,
        toCreate: create.options.styleguideFile,
        toForce: false,
        content: ''
      },
      {
        name: `variables-spm.${create.style}`,
        toCreate: true,
        toForce: false,
        content: ''
      },
      {
        name: `environment.js`,
        toCreate: true,
        toForce: false,
        content: ''
      }
    ]
    let promises = []
    for (let file of filesToCreate) {
      if (file.toCreate) {
        promises.push(Common.writeFilePromise(file.name, file.content, create, file.toForce))
      } else {
        create.warnings.push(`file ${file.name} not created as requested`)
      }
    }
    Promise.all(promises)
    .then(() => resolve(create))
    .catch(reject)
  })
}

/* PROJECT CREATE : to create a new spm project with its core files */
module.exports = (Program) => {
  return new Promise((resolve, reject) => {
    Program
    .command('create')
    .alias('c')
    .description(`to create a new spm project with its core files`)
    .option('--name <name>', `to configure the project's name`)
    .option('--style <style>', `to configure the project's style`)
    .option('--html-name <htmlFile>', `to configure the project's html file`)
    .option('--js-name <jsFile>', `to configure the project's javascript file`)
    .option('--ss-name <ssFile>', `to configure the project's stylesheet file`)
    .option('--styleguide-name <styleguideFile>', `to configure the project's styleguide file`)
    .option('--description <description>', `to configure the project's description`)
    .option('--default', 'to create the project with default values')
    .option('--no-ss-file', 'to prevent creating the spm stylesheet')
    .option('--no-styleguide-file', 'to prevent creating the spm styleguide')
    .option('--no-js-file', 'to prevent creating the spm javascript file')
    .option('--no-html-file', 'to prevent creating the spm html file')
    .option('--no-file', 'to prevent creating any spm file but the json package-spm')
    .option('-f, --force', 'to replace current project-spm.json file if it exists')
    .option('--debug', 'to display debug logs')
    .action(options => {
      let create = new Model.Create(options)
      createProject(create)
      .then(recapAndConfirmPromise)
      .then(createProjectFilePromise)
      .then(Common.displayMessagesPromise)
      .then(resolve)
      .catch(reject)
    })
  })
}
