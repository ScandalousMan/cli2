/* PROJECT LIST : to display the list of dependencies used in your module */
module.exports = (Program) => {
  return new Promise((resolve, reject) => {
    Program
    .command('list')
    .alias('ls')
    .description(`to display the list of dependencies used in your module`)
    .action(() => {
      console.log('module list works !')
      return resolve()
    })
  })
}
