/* PROJECT UNPUBLISH : to remove a project's version or the whole project */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('unpublish')
		.description(`to remove a project's version or the whole project`)
		.action(() => {
			console.log('project unpublish works !')
			return resolve()
		})
	})
}
