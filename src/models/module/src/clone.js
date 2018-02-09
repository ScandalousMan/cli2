/* PROJECT CLONE : to download the source files of a published module */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('clone')
		.description(`to download the source files of a published module`)
		.action(() => {
			console.log('module clone works !')
			return resolve()
		})
	})
}
