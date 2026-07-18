const { makeChildService } = require("./crudFactory");
const { ModelNode } = require("../models");

module.exports = makeChildService(ModelNode);
