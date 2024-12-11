var express = require("express"); 
// On importe le module Express pour créer notre API.
var router = express.Router(); 
// On crée un objet `router` d'Express pour gérer les différentes routes de notre API.
require("../models/connection"); 
// On importe la configuration de la connexion à la base de données.
const User = require("../models/users"); 
// On importe le modèle User pour interagir avec la collection "users" dans la base de données.
const Coloc = require("../models/coloc");
const { checkBody } = require("../modules/checkBody"); 
// On importe une fonction `checkBody` pour valider les données envoyées dans la requête.
const uid2 = require("uid2"); 
// On importe le module `uid2` pour générer des tokens uniques pour les utilisateurs.
const bcrypt = require("bcrypt"); 
// On importe bcrypt pour hasher et vérifier les mots de passe des utilisateurs.



// Route POST pour l'inscription d'un nouvel utilisateur.
router.post("/signup", (req, res) => {

  // On vérifie si les champs "username" et "password" sont présents dans le corps de la requête.
  if (!checkBody(req.body, ["username", "password"])) { 
    res.json({ result: false, error: "Missing or empty fields" });
    // Si des champs sont manquants ou vides, on renvoie une erreur avec un message.
    return;
  }

   // On cherche si un utilisateur avec le même nom d'utilisateur existe déjà.
   User.findOne({ username: req.body.username }).then((data) => {
    if (data === null) { // Si aucun utilisateur n'est trouvé avec ce nom d'utilisateur :
      // On hash le mot de passe de l'utilisateur avec bcrypt pour plus de sécurité.
      const hash = bcrypt.hashSync(req.body.password, 10);

 // Créer une nouvelle colocation pour l'utilisateur
 const newColoc = new Coloc({
  name: req.body.colocname || "Default Coloc", // Nom de la colocation
  location: req.body.location || "Unknown", // Emplacement
  description: req.body.description || "Description de la colocation", // Description
  maxOccupants: 4, // Exemple de nombre d'occupants
});

// Enregistrer la colocation dans la base de données
newColoc.save().then((savedColoc) => {
  // Créer un nouvel utilisateur et lier à la colocation
  const newUser = new User({
    name: req.body.name,
    username: req.body.username,
    email: req.body.email,
    phonenumber: req.body.phonenumber,
    dateofbirth: req.body.dateofbirth,
    password: hash,
    token: uid2(32),
    firstcoloc: req.body.firstcoloc,
    coloc_id: savedColoc._id, // Lier l'utilisateur à la colocation
  });

     // Sauvegarder l'utilisateur dans la base de données
     newUser.save().then((newDoc) => {
      res.json({ result: true, token: newDoc.token });
    });
  });
} else {
  res.json({ result: false, error: "User already exists" });
}
});
});

router.post("/signin", (req, res) => {
  // Route POST pour la connexion d'un utilisateur existant.

  // On vérifie si les champs "username" et "password" sont présents dans le corps de la requête.
  if (!checkBody(req.body, ["username", "password"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    // Si des champs sont manquants ou vides, on renvoie une erreur avec un message.
    return;
  }

  // On cherche un utilisateur avec le nom d'utilisateur fourni dans la requête.
  User.findOne({ username: req.body.username }).then((data) => {
    if (data && bcrypt.compareSync(req.body.password, data.password)) {
      // Si un utilisateur est trouvé et que le mot de passe fourni correspond au mot de passe hashé dans la base de données :
      res.json({ result: true, token: data.token, name: data.name });
      // On renvoie un objet JSON avec "result: true", le token et le nom de l'utilisateur.
    } else {
      // Si l'utilisateur n'est pas trouvé ou si le mot de passe est incorrect :
      res.json({ result: false, error: "User not found or wrong password" });
    }
  });
});

router.post("/createcoloc", (req, res) => {
  if (!checkBody(req.body, ["name", "address", "peoples"])) { 
    res.json({ result: false, error: "Missing or empty fields" });
    // Si des champs sont manquants ou vides, on renvoie une erreur avec un message.
    return;
  }
  
User.findOne({token: req.body.user})
.then((user) => {
  if (user) {
    Coloc.findOne({ name: req.body.name }).then((data) => {
      if (data === null) {
        const newColoc = new Coloc({
          name: req.body.name || "Default coloc name", // Nom de la colocation
          address: req.body.address || "Unknown", // Addresse
          peoples: req.body.peoples || "Nombre de coloc", // Description
          token: uid2(16),
          users:[user._id]
        });
        // Sauvegarder la coloc dans la base de données
        newColoc.save().then((newDoc) => {
          res.json({ result: true, coloc : newDoc});
        });
        } else {
        res.json({ result: false, error: "Coloc already exists" });
        }
        });

  } else {
    res.json({error : "user n'existe pas"})
  }
})

      });
      
module.exports = router;