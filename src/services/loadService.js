const { makeChildService } = require("./crudFactory");
const { ModelLoad } = require("../models");

module.exports = makeChildService(ModelLoad);
