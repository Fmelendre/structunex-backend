const { makeChildService } = require("./crudFactory");
const { ModelSupport } = require("../models");

module.exports = makeChildService(ModelSupport);
