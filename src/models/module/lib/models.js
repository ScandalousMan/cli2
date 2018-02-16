let Preferences = require('preferences')
let Common = require('../../../lib/common')
let CONST = require('../../../lib/const')

/* MODULE */
class Module {
  constructor (create) {
    this.name = create.name
    this.version = create.version
    this.style = create.style
    this.type = create.type
    this.author = create.author
    this.mainClass = create.mainClass
    this.files = {}
    if (create.htmlName) { this.files.index = create.htmlName }
    this.files.script = create.jsName
    this.files.style = create.ssName
    this.description = create.description
    this.dependencies = {}
    this.license = create.license
    this.keywords = create.keywords
    this.contributors = create.contributors
    this.classes = create.classes
  }
}

/* CREATE object */
class Create {
  constructor (name, options) {
    this.initialPath = Common.getCurrentPath()
    let defaultValues = {
      name: name,
      version: '1.0.0',
      style: 'css',
      type: 'native',
      author: new Preferences(CONST.PREFERENCES).user || 'anonymous',
      htmlName: `${name}.html`, // if not in project's scope
      jsName: `${name}.js`,
      ssName: `${name}.${options.style || 'css'}`,
      mainClass: name,
      description: '',
      license: 'MIT',
      keywords: [],
      contributors: [],
      classes: [],
      debug: false,
      default: false,
      force: false,
      flat: false
    }
    for (let key in defaultValues) {
      this[key] = typeof options[key] === 'function'
      ? defaultValues[key]
      : options[key] || defaultValues[key]
    }
    this.options = options
    this.warnings = []
    this.successes = []
    this.errors = []
  }

  /* keys used in the create prompter */
  getKeys () {
    return ['version', 'style', 'mainClass', 'description', 'license', 'keywords', 'classes', 'htmlName', 'ssName', 'jsName']
  }
}

module.exports = {
  Module,
  Create
}
