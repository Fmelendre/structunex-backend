const { makeChildService } = require("./crudFactory");
const { ModelElement } = require("../models");

module.exports = makeChildService(ModelElement);
