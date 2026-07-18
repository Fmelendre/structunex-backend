const { makeChildController } = require("./crudFactory");
const nodeService = require("../services/nodeService");

module.exports = makeChildController(nodeService);
