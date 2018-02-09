/* PROJECT VERSION : to modify your project's version before publication */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('version')
		.alias('v')
		.description(`to modify your project's version before publication`)
		.action(() => {
			console.log('project version works !')
			return resolve()
		})
	})
}
