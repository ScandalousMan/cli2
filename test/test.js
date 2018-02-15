let Standard = require('standard')
let expect = require('chai').expect
const util = require('util')

let importTest = (name, path) => {
  describe(name, function () {
    require(path)
  })
}

/* testing standard.js */
describe('Standard', () => {
  it('standard', done => {
    Standard.lintFiles([], { cwd: 'src' }, function (err, results) {
      if (err) { console.log(err) }
      let issues = []
      for (let result of results.results) {
        if (result.errorCount || result.warningCount) {
          issues.push({ filePath: result.filePath, messages: result.messages })
        }
      }
      expect(issues.length).to.equal(0, util.inspect(issues, false, null))
      done()
    })
  })
})

/* importing all the test categories */
importTest('model USER', './models/USER/test')
importTest('model PROJECT', './models/PROJECT/test')
