/* PROJECT PUBLISH : to send your module to spm registry and factory */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('publish')
		.alias('p')
		.description(`to send your module to spm registry and factory`)
		.action(() => {
			console.log('module publish works !')
			return resolve()
		})
	})
}
