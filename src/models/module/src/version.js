/* PROJECT VERSION : to update a module's version patch, minor, or major value */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('version')
		.alias('v')
		.description(`to update a module's version patch, minor, or major value`)
		.action(() => {
			console.log('module version works !')
			return resolve()
		})
	})
}
