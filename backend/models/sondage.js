
const mongoose = require("mongoose");

const sondageSchema = mongoose.Schema({
  title: String,
  responses: [String],
  user: String,
  colocToken: String,
  createdBy: String,
  votes: {},
}, { timestamps: true });

const Sondage = mongoose.model("sondages", sondageSchema);

module.exports = Sondage;
