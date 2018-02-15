/* PROJECT EDIT : to modify general information about a module before publication */
module.exports = (Program) => {
  return new Promise((resolve, reject) => {
    Program
    .command('edit')
    .alias('e')
    .description(`to modify general information about a module before publication`)
    .action(() => {
      console.log('module edit works !')
      return resolve()
    })
  })
}
