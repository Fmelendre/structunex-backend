const { makeChildService } = require("./crudFactory");
const { ModelArea } = require("../models");

module.exports = makeChildService(ModelArea);
