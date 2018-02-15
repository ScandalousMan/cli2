let sinon = require('sinon')
let expect = require('chai').expect
let projectLib = require('../../../src/models/project')
const cmd = '../../../src/spm2'
let Fs = require('fs')
let Common = require('../../../src/lib/common')

/* TEST */
it('create', done => {
  process.chdir('test/models/PROJECT')
  Fs.mkdir('./files', err => {
    if (!err || err.code === 'EEXIST') {
      process.chdir('files')
      let Program = require('commander')
      projectLib.create(Program)
      .then(() => {
        Fs.readdir('../files', (err, files) => {
          if (err) { console.log(err) }
          const expectedFiles = ['environment.js', 'index.html', 'project-spm.json', 'script.js', 'style.css', 'styleguide.css', 'variables-spm.css']
          for (let file of expectedFiles) { expect(files).to.include(file) }
          Common.getJsonFilePromise('project-spm.json')
          .then(json => {
            expect(json).to.have.all.keys('name', 'style', 'type', 'files', 'description', 'dependencies')
            expect(json.name).to.equal('files')
            done()
          })
          .catch(console.log)
        })
      })
      .catch(console.log)
      Program.parse([cmd, 'project', 'create', '--default'])
    }
  })
})
it('edit', done => {
  sinon.spy(console, 'log')
  let Program = require('commander')
  projectLib.edit(Program)
  .then(() => {
    let args = console.log.args[console.log.args.length - 2][console.log.args[console.log.args.length - 1].length - 1]
    console.log.restore()
    expect(args).to.includes(`project's key style successfully updated to scss`)
    done()
  })
  .catch(console.log)
  Program.parse([cmd, 'project', 'edit', '--style', 'scss'])
})
it('detail', done => {
  sinon.spy(console, 'log')
  let Program = require('commander')
  projectLib.detail(Program)
  .then(() => {
    let args = console.log.args[console.log.args.length - 1][console.log.args[console.log.args.length - 1].length - 1]
    console.log.restore()
    expect(args).to.equal(`{
  "name": "files",
  "style": "scss",
  "type": "native",
  "files": {
    "index": "index.html",
    "script": "script.js",
    "style": "style.css",
    "styleguide": "styleguide.css"
  },
  "description": "",
  "dependencies": {}
}`)
    process.chdir('../.')
    Common.deleteFolderRecursivePromise('./files')
    .then(() => done())
    .catch(console.log)
  })
  .catch(console.log)
  Program.parse([cmd, 'project', 'detail'])
})
