/* PROJECT CREATE : to initialize a new project and generates spm files */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('create')
		.alias('c')
		.description(`to initialize a new project and generates spm files`)
		.action(() => {
			console.log('project create works !')
			return resolve()
		})
	})
}
