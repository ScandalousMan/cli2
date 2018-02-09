/* PROJECT EDIT : to modify a project's general information before publication */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('edit')
		.alias('e')
		.description(`to modify a project's general information before publication`)
		.action(() => {
			console.log('project edit works !')
			return resolve()
		})
	})
}
