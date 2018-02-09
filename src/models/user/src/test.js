
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
    .command('test')
    .alias('t')
    .description('ma description')
    .arguments('[name]')
    .action(name => {
      console.log('enfin on a le name', name)
      return resolve('done')
    })
	})
}