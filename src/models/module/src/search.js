/* PROJECT SEARCH : to browse spm registry about a module you're looking for */
module.exports = (Program) => {
	return new Promise((resolve, reject) => {
		Program
		.command('search')
		.alias('s')
		.description(`to browse spm registry about a module you're looking for`)
		.action(() => {
			console.log('module search works !')
			return resolve()
		})
	})
}
