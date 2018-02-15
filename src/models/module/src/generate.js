/* PROJECT GENERATE : to generate a module's new instance */
module.exports = (Program) => {
  return new Promise((resolve, reject) => {
    Program
    .command('generate')
    .alias('g')
    .description(`to generate a module's new instance`)
    .action(() => {
      console.log('module generate works !')
      return resolve()
    })
  })
}
