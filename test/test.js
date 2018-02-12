let sinon = require('sinon')
let rewire = require('rewire')
let expect = require('chai').expect
let userLib = require('../src/models/user')
const cmd = '../src/spm2'

/* MODIFYING THE FILE FOR BETTER PROMPT */
let Wrapper = require('./inquirer-input-wrapper')

/* different inputs depending on the prompt scenario */
let actions = {
  register: [['testTravis'], ['test@travis.com'], ['Bonjour123']],
  login: [['testTravis'], ['Bonjour123']],
  info: [['n', 'testTravis', 'Bonjour123']]
}

// /* calls a different wrapper for each prompt scenario */
let userPrompt = type => questions => {
  let Prompt = require('inquirer').prompt
  let myPromise = Prompt(questions)
  Wrapper(myPromise.ui, actions[type])
  return myPromise
}

// /* wrap the lib function depending on a mapping, for each scenario, in strict order */
let wrapMyFunc = (files, model) => type => {
  let myCustomFiles = []
  let customFilesMap = {}
  for (let file of files) {
    myCustomFiles.push(rewire(`../src/models/${model}/${file.path}/${file.name.toLowerCase()}`))
    customFilesMap[file.name] = myCustomFiles[myCustomFiles.length - 1]
  }
  for (let i = 0; i < files.length; i++) {
    for (let variable of files[i].variables) {
      myCustomFiles[i].__set__(variable, variable === 'Prompt' ? userPrompt(type) : customFilesMap[variable])
    }
  }
  return myCustomFiles[myCustomFiles.length - 1]
}

let userWrapper = name => {
  return wrapMyFunc([{name: 'Authentify', path: 'lib', variables: ['Prompt']}, {name, path: 'src', variables: ['Authentify']}], 'user')(name)
}

/* defining a spy and its init + restore for each test */
let spy

beforeEach(() => {
  spy = sinon.spy(console, 'log')
})

afterEach(() => {
  console.log.restore()
})

/* TEST */
describe('USER', function () {
  it('register', done => {
    let Program = require('commander')
    userWrapper('register')(Program)
    .then(token => {
      expect(token).to.be.a('string')
      done()
    })
    .catch(err => {
      expect(err.message).to.equal('😱   user testTravis already exists')
      done()
    })
    Program.parse([cmd, 'user', 'register'])
  })
  it('logout', done => {
    let Program = require('commander')
    userLib.logout(Program)
    .then(() => {
      let args = spy.args[spy.args.length - 1][spy.args[spy.args.length - 1].length - 1]
      expect(args).to.include('disconnected')
      done()
    })
    .catch(err => {
      expect(err.message).to.equal('error')
      done()
    })
    Program.parse([cmd, 'user', 'logout'])
  })
  it('login', done => {
    let Program = require('commander')
    userWrapper('login')(Program)
    .then(token => {
      expect(token).to.be.a('string')
      done()
    })
    .catch(err => {
      expect(err.message).to.equal('error')
      done()
    })
    Program.parse([cmd, 'user', 'login'])
  })
  it('detail', done => {
    let Program = require('commander')
    userLib.detail(Program)
    .then(() => {
      let args = spy.args[spy.args.length - 1][spy.args[spy.args.length - 1].length - 1]
      expect(args).to.include('email: test@travis.com')
      done()
    })
    .catch(err => {
      expect(err).to.equal(undefined)
      done()
    })
    Program.parse([cmd, 'user', 'detail'])
  })
})
