/* PROJECT CLEAN : to analyze a project and reorganize spm files */
module.exports = (Program) => {
  return new Promise((resolve, reject) => {
    Program
    .command('clean')
    .description(`to analyze a project and reorganize spm files`)
    .action(() => {
      console.log('project clean works !')
      return resolve()
    })
  })
}

/*

--clean pour ajouter le projet dans le scope dès la publication
pas deux --flat dans le même directory
chercher ${name}.html => si plusieurs html trouvés, on crée ${name}.html avec comme git les conflits affichés

*/
