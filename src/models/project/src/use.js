/* PROJECT USE : to import a spm module in the project */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('use')
		.alias('u')
		.description(`to import a spm module in the project`)
		.action(() => {
			console.log('project use works !')
			return resolve()
		})
	})
}
