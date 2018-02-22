let Preferences = require('preferences')
let Common = require('../../../lib/common')
let CONST = require('../../../lib/const')

/* MODULE */
class Module {
  constructor (create) {
    this.name = create.name
    this.version = create.version
    this.author = create.author
    this.style = create.style
    this.type = create.type
    this.mainClass = create.mainClass
    this.description = create.description
    this.category = create.category
    this.responsive = create.responsive
    this.keywords = create.keywords
    this.dependencies = {}
    this.files = {}
    if (create.htmlName) { this.files.index = create.htmlName }
    this.files.script = create.jsName
    this.files.style = create.ssName
    this.classes = create.classes
    this.readme = create.readme
    this.repository = create.repository
    this.license = create.license
    this.contributors = create.contributors
  }
}

/* CREATE object */
class Create {
  constructor (name, options) {
    this.initialPath = Common.getCurrentPath()
    let defaultValues = {
      name: name,
      version: '1.0.0',
      author: new Preferences(CONST.PREFERENCES).user || 'anonymous',
      style: 'css',
      type: 'native',
      mainClass: name,
      description: '',
      category: '',
      responsive: ['mobile', 'phablet', 'tablet', 'laptop', 'screenXl'],
      keywords: [],
      htmlName: `${name}.html`, // if not in project's scope
      jsName: `${name}.js`,
      ssName: `${name}.${options.style || 'css'}`,
      classes: [],
      readme: '',
      repository: '',
      license: 'MIT',
      contributors: [],
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
  }

  /* keys used in the create prompter */
  getKeys () {
    return ['version', 'style', 'mainClass', 'description', 'repository', 'license', 'keywords', 'classes', 'htmlName', 'ssName', 'jsName']
  }
}

/* PUBLISH object */
class Publish {
  constructor (name, options) {
    this.name = name
    this.version = typeof options.version === 'function' ? null : options.version
    this.initialPath = Common.getCurrentPath()
    this.debug = options.debug || false
    this.force = options.force || false
    this.access = options.access
    this.htmlChecker = options.htmlChecker
    this.warnings = []
    this.successes = []
  }
}

module.exports = {
  Module,
  Create,
  Publish
}
