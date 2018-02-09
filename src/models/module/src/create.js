/* PROJECT CREATE : to create a new spm module with its core files */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('create')
		.alias('c')
		.description(`to create a new spm module with its core files`)
		.action(() => {
			console.log('module create works !')
			return resolve()
		})
	})
}
