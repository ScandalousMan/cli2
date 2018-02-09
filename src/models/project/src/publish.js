/* PROJECT PUBLISH : to send your project to spm factory and registry */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('publish')
		.alias('p')
		.description(`to send your project to spm factory and registry`)
		.action(() => {
			console.log('project publish works !')
			return resolve()
		})
	})
}
