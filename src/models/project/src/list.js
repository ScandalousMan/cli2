/* PROJECT LIST : to list all modules and their dependencies used in the project */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('list')
		.alias('l')
		.description(`to list all modules and their dependencies used in the project`)
		.action(() => {
			console.log('project list works !')
			return resolve()
		})
	})
}
