/* PROJECT ADMIN : to modify your module's permissions */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('admin')
		.description(`to modify your module's permissions`)
		.action(() => {
			console.log('module admin works !')
			return resolve()
		})
	})
}
