/* PROJECT DETAIL : to access a project's general information */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('detail')
		.alias('d')
		.description(`to access a project's general information`)
		.action(() => {
			console.log('project detail works !')
			return resolve()
		})
	})
}
