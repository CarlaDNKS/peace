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
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const uniqid = require("uniqid");

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
    if (data === null) {
      // Si aucun utilisateur n'est trouvé avec ce nom d'utilisateur :
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

  // Vérification des champs requis
  if (!checkBody(req.body, ["username", "password"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  // Recherche de l'utilisateur
  User.findOne({ username: req.body.username }).then((data) => {
    // Vérification de l'existence de l'utilisateur et du mot de passe
    if (!data || !bcrypt.compareSync(req.body.password, data.password)) {
      res.json({ result: false, error: "User not found or wrong password" });
      return;
    }

    // Si l'utilisateur n'a pas de token de colocation
    if (!data.colocToken) {
      res.json({
        result: true,
        token: data.token,
        name: data.name,
        hasColoc: false,
        redirect: "Choice",
      });
      return;
    }

    // Recherche de la colocation associée
    Coloc.findOne({ token: data.colocToken }).then((colocInfo) => {
      if (colocInfo) {
        res.json({
          result: true,
          token: data.token,
          name: data.name,
          hasColoc: true,
          colocInfo,
          redirect: "TabNavigator",
        });
      } else {
        // Le token de colocation existe mais la colocation n'est pas trouvée
        // On met à jour l'utilisateur pour retirer le token de colocation invalide
        User.updateOne({ _id: data._id }, { $unset: { colocToken: 1 } }).then(
          () => {
            res.json({
              result: true,
              token: data.token,
              name: data.name,
              hasColoc: false,
              redirect: "Choice",
            });
          }
        );
      }
    });
  });
});

router.post("/createcoloc", (req, res) => {
  if (!checkBody(req.body, ["name", "address", "peoples"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  User.findOne({ token: req.body.user }).then((user) => {
    if (user) {
      Coloc.findOne({ name: req.body.name }).then((data) => {
        if (data === null) {
          const colocToken = uid2(16);

          const newColoc = new Coloc({
            name: req.body.name || "Default coloc name",
            address: req.body.address || "Unknown",
            peoples: req.body.peoples || "Nombre de coloc",
            token: colocToken,
            users: [user._id],
          });

          newColoc.save().then((newDoc) => {
            return User.updateOne(
              { _id: user._id },
              {
                colocToken: colocToken,
              }
            ).then(() => {
              res.json({ result: true, coloc: newDoc });
            });
          });
        } else {
          res.json({ result: false, error: "Coloc already exists" });
        }
      });
    } else {
      res.json({ error: "user n'existe pas" });
    }
  });
});

router.post("/joincoloc", (req, res) => {
  if (!checkBody(req.body, ["token", "user"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  // Trouver la coloc en fonction du token
  Coloc.findOne({ token: req.body.token })
    .then((coloc) => {
      if (!coloc) {
        return res.json({ result: false, error: "Coloc not found" });
      }

      // Trouver l'utilisateur en fonction du token
      User.findOne({ token: req.body.user })
        .then((user) => {
          if (!user) {
            return res.json({ result: false, error: "User not found" });
          }

          // Vérifier si l'utilisateur est déjà dans la liste des utilisateurs de la coloc
          const userId = user._id;
          const userAlreadyInColoc = coloc.users.includes(userId);

          if (userAlreadyInColoc) {
            return res.json({
              result: false,
              error: "User already in the coloc",
            });
          }

          // Si l'utilisateur n'est pas encore dans la coloc, on l'ajoute
          coloc.users.push(userId);

          // Mettre à jour le token de la coloc dans l'utilisateur
          user.colocToken = coloc.token;

          // Sauvegarder la coloc et l'utilisateur avec les modifications
          coloc
            .save()
            .then(() => {
              user
                .save()
                .then(() => {
                  // Trouver à nouveau la coloc pour renvoyer les informations à jour
                  Coloc.findOne({ token: req.body.token })
                    .then((colocInfo) => {
                      if (colocInfo) {
                        res.json({
                          result: true,
                          message: "User added to coloc",
                          colocInfo: colocInfo, // Ajout des informations de la coloc dans la réponse
                        });
                      } else {
                        res.json({
                          result: false,
                          error: "Coloc not found after update",
                        });
                      }
                    })
                    .catch((error) => {
                      res.json({
                        result: false,
                        error:
                          "Error finding coloc info after update: " +
                          error.message,
                      });
                    });
                })
                .catch((error) => {
                  res.json({
                    result: false,
                    error: "Error saving user: " + error.message,
                  });
                });
            })
            .catch((error) => {
              res.json({
                result: false,
                error: "Error saving coloc: " + error.message,
              });
            });
        })
        .catch((error) => {
          res.json({
            result: false,
            error: "Error finding user: " + error.message,
          });
        });
    })
    .catch((error) => {
      res.json({
        result: false,
        error: "Error finding coloc: " + error.message,
      });
    });
});

// Route pour récupérer les événements
router.get("/:token", async (req, res) => {
  try {
    const userDet = await User.findOne({
      token: req.params.token,
    }); // Récupérer tous les événements dans la base de données
    if (userDet) {
      res.json({ userDet }); // Répondre avec les événements au format JSON
    } else {
      res.json({ error: "Utilisateur non trouvé" });
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des événements:", error);
    res.json({
      message: "Erreur lors de la récupération des événements",
      error,
    });
  }
});

router.delete("/:token", async (req, res) => {
  User.findOne({ token: req.params.token }).then((user) => {
    if (user) {
      Coloc.updateOne(
        { token: user.colocToken },
        { $pull: { users: user._id } }
      ).then((info) => {
        if (info.acknowledged) {
          user.colocToken = "";
          user.save().then(() =>
            res.json({
              result: true,
              message: "Utilisateur supprimé avec succès de la coloc",
            })
          );
        } else {
          res.json({
            result: false,
            error: "Utilisateur non supprimé de coloc",
          });
        }
      });
    } else {
      res.json({ result: false, error: "Utilisateur introuvable" });
    }
  });
});

//ROUTE PROFIL DESCRIPTION
router.put("/updateProfile", async (req, res) => {
  const user = await User.findOne({ token: req.body.token });
  if (!user) {
    return res.json({ result: false, error: "Utilisateur non trouvé" });
  }

  try {
    // Mise à jour de la description, des liens sociaux
    user.description = req.body.description || user.description; // Si la description est présente, on la met à jour
    user.facebook = req.body.facebook || user.facebook; // Mise à jour du lien Facebook, s'il est présent
    user.instagram = req.body.instagram || user.instagram; // Mise à jour du lien Instagram, s'il est présent

    // Sauvegarde des modifications
    await user.save();

    return res.json({ result: true });
  } catch (error) {
    console.error(error);
    return res.json({ result: false, error: "Erreur serveur" });
  }
});

//ROUTE Post pour photo
router.post("/uploadpicture/:usertoken", async (req, res) => {
  try {
    // Crée un chemin temporaire pour sauvegarder l'image avant de la télécharger sur Cloudinary
    const photoPath = `/tmp/${uniqid()}.jpg`;

    // Déplace le fichier reçu depuis le frontend vers le chemin temporaire
    const resultMove = await req.files.photoFromFront.mv(photoPath);

    if (!resultMove) {
      // Si le fichier est déplacé avec succès, upload sur Cloudinary
      const resultCloudinary = await cloudinary.uploader.upload(photoPath);

      // Supprime le fichier temporaire
      fs.unlinkSync(photoPath);

      // Recherche l'utilisateur dans la base de données
      const user = await User.findOne({ token: req.params.usertoken });

      if (!user) {
        return res.json({ result: false, error: "User not found" });
      }

      // Mets à jour le champ profilPicture de l'utilisateur avec l'URL retournée par Cloudinary
      user.profilpicture = resultCloudinary.secure_url;

      // Sauvegarde l'utilisateur avec la nouvelle photo de profil
      await user.save();

      // Envoie la réponse avec l'URL de l'image Cloudinary
      res.json({
        result: true,
        url: resultCloudinary.secure_url,
      });
    } else {
      res.json({ result: false, error: resultMove });
    }
  } catch (error) {
    console.error("Erreur lors de l'upload back", error);
    res.json({ result: false, error: "Internal Server Error back" });
  }
});

module.exports = router;
