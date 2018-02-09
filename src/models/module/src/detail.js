/* PROJECT DETAIL : to display information about a module */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('detail')
		.alias('d')
		.description(`to display information about a module`)
		.action(() => {
			console.log('module detail works !')
			return resolve()
		})
	})
}
