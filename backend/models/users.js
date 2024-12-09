const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  name: String,
  username: String,
  email: String,
  password: String,
  google_id: String,
  token: String,
  phonenumber: Number,
  dateofbirth: Date,
  firstcoloc: String,
  profilpicture: String,
  arrivaldate: Date,
  description: String,
  colocname: String, 
  coloc_id: { type: mongoose.Schema.Types.ObjectId, ref: 'coloc' },
  badgeearned: String,
});

const User = mongoose.model("users", userSchema);

module.exports = User;
