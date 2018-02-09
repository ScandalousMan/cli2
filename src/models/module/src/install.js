/* PROJECT INSTALL : to use a specific module as a dependency */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('install')
		.alias('i')
		.description(`to use a specific module as a dependency`)
		.action(() => {
			console.log('module install works !')
			return resolve()
		})
	})
}
