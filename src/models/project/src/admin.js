/* PROJECT ADMIN : to modify a project's permissions */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('admin')
		.description(`to modify a project's permissions`)
		.action(() => {
			console.log('project admin works !')
			return resolve()
		})
	})
}
