var express = require("express");
var router = express.Router();
require("../models/connection");
const Sondage = require("../models/sondage");
const Coloc = require("../models/coloc");
const User = require("../models/users");
const { checkBody } = require("../modules/checkBody");





router.post("/createSondage", async (req, res) => {

    const { userToken, colocToken, title, responses, username } = req.body;

    // On vérifie si les champs "username" et "password" sont présents dans le corps de la requête.
    if (!checkBody(req.body, ["title", "responses"])) {
      res.json({ result: false, error: "Missing or empty fields" });
      // Si des champs sont manquants ou vides, on renvoie une erreur avec un message.
      return;
    }

    const user = await User.findOne({ token: userToken });
    if (!user) {
      return res.json({ result: false, error: "Token utilisateur invalide" });
    }

    const coloc = await Coloc.findOne({ token: colocToken });
    if (!coloc) {
      return res.json({ result: false, error: "Token coloc invalide" });
    }

// On cherche si un sondage avec le même titre existe déjà.
Sondage.findOne({ title: req.body.title }).then((sondage) => {
    if (sondage === null) {
      // Si aucun sondage n'est trouvé avec ce titre :

      // Créer un nouveau sondage pour l'utilisateur
      const newSondage = new Sondage({
        title: title,
        responses: responses,
        user: userToken, 
        colocToken: colocToken,
        createdBy: user.username,
        votes: {}
      });
responses.forEach(element => {
  newSondage.votes[element] = []
});
      // Enregistre le sondage dans la base de données
      newSondage.save()
      .then(() => res.json({ result: true, message: 'Sondage créé avec succès' }))
    }else{
        res.json({ result: false, error: "Un sondage avec ce titre existe déjà" });
    }
}
)}
);


router.get("/getSondages", (req, res) => {
    Sondage.find() // Récupérer tous les sondages
      .then((sondages) => {
        res.json({ result: true, sondages });
      });
  });


router.put("/vote", async (req, res) => {

  const sondage = await Sondage.findById(req.body._id);

  const updates = {};
  
  // Créer une requête $pull pour chaque clé dynamique
  for (const key in sondage.votes) {
    updates[`votes.${key}`] = req.body.userToken;
  }

  // Appliquer la mise à jour
 await Sondage.updateOne(
    { _id : req.body._id },
    { $pull: updates }
  );

  const chemin = `votes.${req.body.vote}`
  Sondage.updateOne({_id : req.body._id},{$push : {[chemin] : req.body.userToken}})
  .then((vote) => {
    if(vote.acknowledged){
    res.json({result: true})}
    else{
      res.json({result: false})
    }
  })
})

router.put("/deleteVote", (req, res) => {
  const chemin = `votes.${req.body.vote}`
  Sondage.updateOne({_id : req.body._id},{$pull : {[chemin] : req.body.userToken}})
  .then((vote) => {
    if(vote.acknowledged){
    res.json({result: true})}
    else{
      res.json({result: false})
    }
  })
})




module.exports = router;
