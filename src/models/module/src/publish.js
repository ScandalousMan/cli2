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

/*

--clean pour ajouter le projet dans le scope dès la publication
pas deux --flat dans le même directory
chercher ${name}.html => si plusieurs html trouvés, on crée ${name}.html avec comme git les conflits affichés

*/
