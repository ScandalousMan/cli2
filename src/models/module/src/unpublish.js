/* PROJECT UNPUBLISH : to remove a module's version or a whole module from spm registry */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('unpublish')
		.description(`to remove a module's version or a whole module from spm registry`)
		.action(() => {
			console.log('module unpublish works !')
			return resolve()
		})
	})
}
